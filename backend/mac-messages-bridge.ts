import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {Hono} from 'hono';
import {z} from 'zod';
import type {Pool,PoolClient} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {queueCaseAgentEvent} from './case-agent-events';
import {normalizedPhone,isTestPhone} from './phone-messaging';
export const macBridgeEnabled=()=>process.env.MAC_MESSAGES_BRIDGE_ENABLED==='true'&&process.env.PHONE_NOTIFICATION_PROVIDER==='mac_messages';
export async function macBridgeReady(pool:Pool){
 if(!macBridgeEnabled()||!process.env.MAC_MESSAGES_SENDER_LABEL||!['sms','imessage'].includes(process.env.MAC_MESSAGES_TRANSPORT??''))return false;
 const {rows}=await pool.query("SELECT id FROM advocacy_mac_bridge_status WHERE id='primary' AND ready=true AND seen_at>now()-interval '90 seconds' AND transport=$1 AND sender_label=$2",[process.env.MAC_MESSAGES_TRANSPORT,process.env.MAC_MESSAGES_SENDER_LABEL]);return rows.length===1;
}
async function eligible(client:PoolClient,n:any){
 const {rows:[p]}=n.owner_id?await client.query('SELECT phone,sms_consent FROM advocacy_phone_preferences WHERE owner_id=$1 FOR UPDATE',[n.owner_id]):await client.query('SELECT phone,sms_consent FROM advocacy_phone_intakes WHERE id=$1 AND expires_at>now() FOR UPDATE',[n.intake_id]);
 if(!p?.sms_consent||!normalizedPhone(p.phone)||isTestPhone(p.phone))return null;
 const allow=(process.env.PHONE_ALLOWED_NUMBERS??'').split(',').map(v=>v.trim()).filter(Boolean);if(allow.length&&!allow.includes(p.phone))return null;
 if(n.case_id){const active=await client.query("SELECT id FROM advocacy_case_authorities WHERE case_id=$1 AND approved_by=$2 AND state IN ('active','waiting','human_required') AND (policy->>'version'='2' OR (policy->>'expires_at')::timestamptz>now())",[n.case_id,n.owner_id]);if(!active.rowCount)return null;}
 return p.phone as string;
}
export async function claimMacMessage(pool:Pool){
 if(process.env.PHONE_FLOW_ENABLED!=='true'||!await macBridgeReady(pool))return {job:null};
 const c=await pool.connect();try{await c.query('BEGIN');
 // Claimed work is never reassigned. A lost acknowledgement may hide a real send.
 await c.query("UPDATE advocacy_mac_bridge_deliveries SET state='unknown',reason='Bridge receipt overdue',updated_at=now() WHERE state='claimed' AND claimed_at<now()-interval '2 minutes'");
 await c.query("UPDATE advocacy_phone_notifications n SET state='unknown',reason='Bridge receipt overdue' FROM advocacy_mac_bridge_deliveries d WHERE d.notification_id=n.id AND d.state='unknown' AND n.state='dispatching'");
 const {rows:[n]}=await c.query("SELECT n.* FROM advocacy_phone_notifications n LEFT JOIN advocacy_phone_preferences p ON p.owner_id=n.owner_id LEFT JOIN advocacy_phone_intakes i ON i.id=n.intake_id WHERE n.state='queued' AND NOT EXISTS(SELECT 1 FROM advocacy_mac_bridge_deliveries d WHERE d.destination=COALESCE(p.phone,i.phone) AND d.state IN ('claimed','unknown')) ORDER BY n.created_at FOR UPDATE OF n SKIP LOCKED LIMIT 1");
 if(!n){await c.query('COMMIT');return {job:null};}
 const to=await eligible(c,n);if(!to){await c.query("UPDATE advocacy_phone_notifications SET state='cancelled',reason='Consent, recipient, or case authority unavailable' WHERE id=$1",[n.id]);await c.query('COMMIT');return {job:null};}
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`phone-send:${to}`]);
 const pending=await c.query("SELECT notification_id FROM advocacy_mac_bridge_deliveries WHERE destination=$1 AND state IN ('claimed','unknown') LIMIT 1",[to]);if(pending.rowCount){await c.query('COMMIT');return {job:null};}
 const attempt=randomUUID(),transport=process.env.MAC_MESSAGES_TRANSPORT!;
 await c.query('INSERT INTO advocacy_mac_bridge_deliveries(notification_id,attempt_id,destination,transport) VALUES($1,$2,$3,$4)',[n.id,attempt,to,transport]);
 await c.query("UPDATE advocacy_phone_notifications SET state='dispatching' WHERE id=$1",[n.id]);await c.query('COMMIT');
 return {job:{id:n.id,attempt_id:attempt,to,body:n.body,transport}};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function recordMacReceipt(pool:Pool,input:{id:string;attempt_id:string;state:'submitted'|'unknown'|'failed';provider_id?:string;reason?:string}){
 const c=await pool.connect();try{await c.query('BEGIN');
 const {rows:[d]}=await c.query('SELECT * FROM advocacy_mac_bridge_deliveries WHERE notification_id=$1 AND attempt_id=$2 FOR UPDATE',[input.id,input.attempt_id]);if(!d)throw Error('RECEIPT_NOT_FOUND');
 if(d.state!== 'claimed'&&d.state!=='unknown'){if(d.state!==input.state||d.provider_id!==(input.provider_id??null))throw Error('RECEIPT_CONFLICT');await c.query('COMMIT');return {recorded:true};}
 // An overdue unknown can be reconciled by this exact attempt's durable local receipt.
 await c.query('UPDATE advocacy_mac_bridge_deliveries SET state=$2,provider_id=$3,reason=$4,updated_at=now() WHERE notification_id=$1',[input.id,input.state,input.provider_id??null,input.reason??null]);
 await c.query("UPDATE advocacy_phone_notifications SET state=$2,provider_id=$3,reason=$4,sent_at=CASE WHEN $2='submitted' THEN now() ELSE sent_at END WHERE id=$1",[input.id,input.state==='failed'?'held':input.state,input.provider_id?`mac_messages:${input.provider_id}`:null,input.reason??null]);
 await c.query('COMMIT');return {recorded:true};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function ingestMacReply(pool:Pool,input:{event_id:string;from:string;text:string;received_at:string;thread?:string}){
 const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex'),c=await pool.connect();
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`mac-reply:${input.event_id}`]);
 const {rows:[prior]}=await c.query('SELECT payload_hash,disposition FROM advocacy_mac_bridge_inbound WHERE event_id=$1',[input.event_id]);if(prior){if(prior.payload_hash!==hash)throw Error('EVENT_CONFLICT');await c.query('COMMIT');return {disposition:prior.disposition};}
 // Only a recipient already contacted by this bridge is eligible for ingestion.
 const sent=await c.query("SELECT n.case_id,n.owner_id,d.claimed_at FROM advocacy_mac_bridge_deliveries d JOIN advocacy_phone_notifications n ON n.id=d.notification_id WHERE d.destination=$1 AND d.state='submitted' AND d.claimed_at<=$2::timestamptz AND d.claimed_at>now()-interval '30 days'",[input.from,input.received_at]);
 if(!sent.rowCount){await c.query('COMMIT');return {disposition:'ignored_untracked'};}
 let disposition='held_ambiguous',caseId:string|null=null;
 if(/^\s*(stop|unsubscribe|cancel|end|quit)\s*$/i.test(input.text)){
  await c.query('UPDATE advocacy_phone_preferences SET sms_consent=false,updated_at=now() WHERE phone=$1',[input.from]);await c.query('UPDATE advocacy_phone_intakes SET sms_consent=false WHERE phone=$1',[input.from]);
  await c.query("UPDATE advocacy_phone_notifications SET state='cancelled',reason='Text opt-out' WHERE state='queued' AND (owner_id IN(SELECT owner_id FROM advocacy_phone_preferences WHERE phone=$1) OR intake_id IN(SELECT id FROM advocacy_phone_intakes WHERE phone=$1))",[input.from]);disposition='opt_out';
 }else{
  const eligibleCases=await c.query("SELECT DISTINCT c.id FROM advocacy_cases c JOIN advocacy_phone_preferences p ON p.owner_id=c.owner_id AND p.phone=$1 AND p.sms_consent=true JOIN advocacy_case_authorities a ON a.case_id=c.id AND a.approved_by=c.owner_id AND a.state IN ('active','waiting','human_required') AND (a.policy->>'version'='2' OR (a.policy->>'expires_at')::timestamptz>now()) WHERE c.id=ANY($2::uuid[])",[input.from,sent.rows.map(r=>r.case_id).filter(Boolean)]);
  if(eligibleCases.rowCount===1){caseId=eligibleCases.rows[0].id;disposition='accepted';await c.query("SELECT id FROM advocacy_cases WHERE id=$1 FOR UPDATE",[caseId]);
   await c.query("UPDATE advocacy_cases SET revision=revision+1,analysis=NULL,status='new' WHERE id=$1",[caseId]);
   await queueCaseAgentEvent(drizzle(c),caseId!,`mac-message:${input.event_id}`,'phone_reply',{text:input.text,received_at:input.received_at,trust:'unverified_message_from_linked_phone'});
  }
 }
 await c.query('INSERT INTO advocacy_mac_bridge_inbound(event_id,payload_hash,phone,body,case_id,disposition,received_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[input.event_id,hash,input.from,input.text,caseId,disposition,input.received_at]);await c.query('COMMIT');return {disposition};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export function macMessagesRoutes(pool:Pool){
 const app=new Hono();
 app.use('*',async(c,next)=>{
  const expected=process.env.MAC_MESSAGES_BRIDGE_TOKEN??'',header=c.req.header('authorization')??'',given=header.startsWith('Bearer ')?header.slice(7):'';
  if(expected.length<32||Buffer.byteLength(given)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(expected),Buffer.from(given)))return c.json({error:'Unauthorized'},401);
  if(!macBridgeEnabled())return c.json({error:'Bridge disabled'},503);await next();
 });
 app.post('/heartbeat',async c=>{const v=z.object({ready:z.boolean(),transport:z.enum(['sms','imessage']),sender_label:z.string().min(1).max(200)}).strict().safeParse(await c.req.json());if(!v.success)return c.json({error:'Invalid heartbeat'},400);
  if(v.data.transport!==process.env.MAC_MESSAGES_TRANSPORT||v.data.sender_label!==process.env.MAC_MESSAGES_SENDER_LABEL)return c.json({error:'Sender configuration mismatch'},409);
  await pool.query("INSERT INTO advocacy_mac_bridge_status(id,ready,transport,sender_label) VALUES('primary',$1,$2,$3) ON CONFLICT(id) DO UPDATE SET ready=$1,transport=$2,sender_label=$3,seen_at=now()",[v.data.ready,v.data.transport,v.data.sender_label]);return c.json({recorded:true});});
 app.post('/claim',async c=>c.json(await claimMacMessage(pool)));
 app.post('/receipt',async c=>{const v=z.object({id:z.uuid(),attempt_id:z.uuid(),state:z.enum(['submitted','unknown','failed']),provider_id:z.string().max(200).optional(),reason:z.string().max(500).optional()}).strict().safeParse(await c.req.json());if(!v.success)return c.json({error:'Invalid receipt'},400);try{return c.json(await recordMacReceipt(pool,v.data));}catch{return c.json({error:'Receipt mismatch'},409);}});
 app.post('/inbound',async c=>{const v=z.object({event_id:z.string().min(1).max(200),from:z.string().regex(/^\+[1-9]\d{7,14}$/),text:z.string().min(1).max(4000),received_at:z.iso.datetime(),thread:z.string().max(200).optional()}).strict().safeParse(await c.req.json());if(!v.success||Date.parse(v.data.received_at)>Date.now()+60000)return c.json({error:'Invalid message'},400);try{return c.json(await ingestMacReply(pool,v.data));}catch{return c.json({error:'Message mismatch'},409);}});
 return app;
}
