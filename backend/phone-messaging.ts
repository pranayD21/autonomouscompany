import {createHmac,timingSafeEqual} from 'node:crypto';
import type {Pool} from 'pg';
export const normalizedPhone=(value:unknown)=>typeof value==='string'&&/^\+[1-9]\d{7,14}$/.test(value)?value:null;
export const phoneOwner=(id:string)=>`phone:${id}`;
export const portalUrl=(caseId?:string)=>`https://assurance.claims/${caseId?`?case=${encodeURIComponent(caseId)}`:''}#workspace`;
export function validPhoneWebhook(raw:string,headers:Headers,secret:string,now=Date.now()){
 const timestamp=headers.get('x-webhook-timestamp')??'',signature=headers.get('x-webhook-signature')??'';
 if(!secret||!/^\d{1,12}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
 return timingSafeEqual(Buffer.from(signature.slice(7),'hex'),createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest());
}
export async function smsReady(send:typeof fetch=fetch){
 if(process.env.PHONE_FLOW_ENABLED!=='true'||!process.env.AGENTPHONE_API_KEY||!process.env.AGENTPHONE_NUMBER_ID)return false;
 const r=await send(`https://api.agentphone.ai/v1/numbers/${encodeURIComponent(process.env.AGENTPHONE_NUMBER_ID)}`,{headers:{Authorization:`Bearer ${process.env.AGENTPHONE_API_KEY}`},signal:AbortSignal.timeout(5000)});
 return r.ok&&(await r.json()).outboundSms==='enabled';
}
export async function sendPhoneText(to:string,body:string,send:typeof fetch=fetch){
 if(!normalizedPhone(to)||!(process.env.PHONE_ALLOWED_NUMBERS??'').split(',').includes(to))throw Error('PHONE_RECIPIENT_NOT_APPROVED');
 if(!await smsReady(send))throw Error('SMS_NOT_READY');
 const r=await send('https://api.agentphone.ai/v1/messages',{method:'POST',headers:{Authorization:`Bearer ${process.env.AGENTPHONE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({number_id:process.env.AGENTPHONE_NUMBER_ID,agent_id:process.env.AGENTPHONE_AGENT_ID,to_number:to,body}),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error(`SMS_REJECTED_${r.status}`);
 const data=await r.json();if(typeof data.id!=='string'||!data.id)throw Error('SMS_OUTCOME_UNKNOWN');return data.id as string;
}
export async function enqueueDocumentNotice(pool:Pool,caseId:string,documentId:string,reason:string){
 if(process.env.PHONE_FLOW_ENABLED!=='true')return;
 const text=`Assurance: A document needs attention. Sign in to review what to fix: ${portalUrl(caseId)} Reply STOP to stop case texts.`;
 await pool.query(`INSERT INTO advocacy_phone_notifications(dedupe_key,owner_id,case_id,kind,body,reason)
 SELECT $1,c.owner_id,c.id,'document_problem',$2,$3 FROM advocacy_cases c JOIN advocacy_phone_preferences p ON p.owner_id=c.owner_id AND p.sms_consent=true WHERE c.id=$4 ON CONFLICT DO NOTHING`,[`document:${documentId}:${reason}`,text,reason,caseId]);
 await deliverPhoneNotifications(pool);
}
export async function deliverPhoneNotifications(pool:Pool,sender=sendPhoneText){
 const found=await pool.query(`SELECT n.id FROM advocacy_phone_notifications n WHERE n.state='queued' ORDER BY n.created_at LIMIT 10`);
 for(const {id} of found.rows){
  const c=await pool.connect();let to:string|undefined,body:string|undefined;
  try{await c.query('BEGIN');
   await c.query("SELECT pg_advisory_xact_lock(hashtext('phone-notification-budget'))");
   const {rows:[n]}=await c.query(`SELECT * FROM advocacy_phone_notifications WHERE id=$1 AND state='queued' FOR UPDATE SKIP LOCKED`,[id]);if(!n){await c.query('ROLLBACK');continue;}
   const {rows:[p]}=n.owner_id?await c.query('SELECT * FROM advocacy_phone_preferences WHERE owner_id=$1 FOR UPDATE',[n.owner_id]):await c.query('SELECT phone,sms_consent FROM advocacy_phone_intakes WHERE id=$1 FOR UPDATE',[n.intake_id]);
   if(p?.phone)await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`phone-send:${p.phone}`]);
   if(!p?.sms_consent){await c.query("UPDATE advocacy_phone_notifications SET state='cancelled',reason='No active text consent' WHERE id=$1",[id]);await c.query('COMMIT');continue;}
   const sent=await c.query(`SELECT count(*)::int AS count FROM advocacy_phone_notifications n LEFT JOIN advocacy_phone_intakes i ON i.id=n.intake_id LEFT JOIN advocacy_phone_preferences p ON p.owner_id=n.owner_id WHERE coalesce(p.phone,i.phone)=$1 AND n.state IN ('dispatching','submitted','unknown') AND n.created_at>now()-interval '1 day'`,[p.phone]);
   const total=await c.query("SELECT count(*)::int AS count FROM advocacy_phone_notifications WHERE state IN ('dispatching','submitted','unknown') AND created_at>now()-interval '1 day'");
   if(sent.rows[0].count>=6||total.rows[0].count>=30){await c.query("UPDATE advocacy_phone_notifications SET state='held',reason='Daily notification limit reached' WHERE id=$1",[id]);await c.query('COMMIT');continue;}
   await c.query("UPDATE advocacy_phone_notifications SET state='dispatching' WHERE id=$1",[id]);to=p.phone;body=n.body;await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  if(!to||!body)continue;
  try{const provider=await sender(to,body);await pool.query("UPDATE advocacy_phone_notifications SET state='submitted',provider_id=$2,sent_at=now() WHERE id=$1",[id,provider]);}
  catch(e){const reason=e instanceof Error?e.message:'SMS_OUTCOME_UNKNOWN';const rejected=/^(SMS_NOT_READY|PHONE_RECIPIENT_NOT_APPROVED|SMS_REJECTED_4\d\d)$/.test(reason);await pool.query("UPDATE advocacy_phone_notifications SET state=$2,reason=$3 WHERE id=$1",[id,rejected?'held':'unknown',reason]);}
 }
}
