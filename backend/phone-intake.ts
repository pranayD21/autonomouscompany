import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {sql} from 'drizzle-orm';
import {authorizeCase} from './autonomy-service';
import {DEFAULT_INTAKE_CONSENT} from './intake-policy';
import {normalizedPhone,portalUrl} from './phone-messaging';
const yes=(s:string)=>/^(yes|yeah|yep|sure|okay|ok|i agree|i consent)[.!\s]*$/i.test(s.trim());
export async function handlePhoneEvent(pool:Pool,deliveryId:string,raw:string){
 const payload=JSON.parse(raw),data=payload.data??{};
 if(payload.agentId!==process.env.AGENTPHONE_AGENT_ID||data.numberId!==process.env.AGENTPHONE_NUMBER_ID)throw Error('WRONG_PHONE_ROUTE');
 if(data.direction!=='inbound')return {ok:true,ignored:true};
 const phone=normalizedPhone(data.from);if(!phone)throw Error('INVALID_CALLER');
 const hash=createHash('sha256').update(raw).digest('hex');
 const client=await pool.connect();
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`phone-event:${deliveryId}`]);
  const {rows:[prior]}=await client.query('SELECT * FROM advocacy_phone_events WHERE id=$1',[deliveryId]);
  if(prior){if(prior.payload_hash!==hash)throw Error('WEBHOOK_ID_CONFLICT');await client.query('COMMIT');return prior.response;}
  let response:Record<string,unknown>={ok:true};
  if(payload.channel==='sms'&&payload.event==='agent.message'){
   if(/^\s*(stop|unsubscribe|cancel|end|quit)\s*$/i.test(data.message??'')){
    await client.query('UPDATE advocacy_phone_preferences SET sms_consent=false,updated_at=now() WHERE phone=$1',[phone]);await client.query('UPDATE advocacy_phone_intakes SET sms_consent=false WHERE phone=$1',[phone]);
    await client.query("UPDATE advocacy_phone_notifications SET state='cancelled',reason='Text opt-out' WHERE state='queued' AND (owner_id IN (SELECT owner_id FROM advocacy_phone_preferences WHERE phone=$1) OR intake_id IN (SELECT id FROM advocacy_phone_intakes WHERE phone=$1))",[phone]);
   }
  }else if(payload.event==='agent.message'&&payload.channel==='voice'){
   if(typeof data.callId!=='string'||typeof data.transcript!=='string'||data.transcript.length>4000)throw Error('INVALID_VOICE_EVENT');
   await client.query("INSERT INTO advocacy_phone_intakes(call_id,phone,expires_at) VALUES($1,$2,now()+interval '24 hours') ON CONFLICT DO NOTHING",[data.callId,phone]);
   const {rows:[intake]}=await client.query('SELECT * FROM advocacy_phone_intakes WHERE call_id=$1 FOR UPDATE',[data.callId]);
   if(intake.phone!==phone||intake.expires_at<=new Date())throw Error('CALL_BINDING_MISMATCH');
   const said=data.transcript.trim();
   if(intake.stage==='consent'){
    if(yes(said)){await client.query("UPDATE advocacy_phone_intakes SET stage='type',sms_consent=true WHERE id=$1",[intake.id]);response={text:'Thank you. Is this about a workplace injury, or a health insurance claim?'};}
    else response={text:'Assurance can organize your claim, research it, and contact the relevant organizations after you verify your phone. We will not make payments or accept settlements. May we handle your case and text this number a secure upload link and case updates? Say yes to continue, or visit assurance dot claims to use the website.',hangup:/\b(no|stop|bye)\b/i.test(said)};
   }else if(intake.stage==='type'){
    const type=/work|employer|job/i.test(said)?'workplace_injury':/health|insurance|medical/i.test(said)?'health_insurance':null;
    if(!type)response={text:'Please say workplace injury or health insurance claim.'};
    else{await client.query("UPDATE advocacy_phone_intakes SET stage='story',case_type=$2 WHERE id=$1",[intake.id,type]);response={text:'Tell me what happened and what you need help with.'};}
   }else if(intake.stage==='story'){
    if(said.length<10)response={text:'Please tell me a little more about what happened.'};
    else{
     await client.query("UPDATE advocacy_phone_intakes SET stage='portal',narrative=$2 WHERE id=$1",[intake.id,said]);
     await client.query("INSERT INTO advocacy_phone_notifications(dedupe_key,intake_id,kind,body) VALUES($1,$2,'portal_link',$3) ON CONFLICT DO NOTHING",[`intake:${intake.id}`,intake.id,`Assurance: Upload your documents at ${portalUrl()} Sign in with this phone number to continue your case. Reply STOP to stop case texts.`]);
     response={text:'I have your account of what happened. A secure upload-link text is queued. Sign in with this phone number to continue your case and add any documents you have.'};
    }
   }else response={text:'Your intake is waiting in the Assurance portal. Sign in with your phone number to continue, add documents, or see case updates.'};
  }
  await client.query('INSERT INTO advocacy_phone_events(id,payload_hash,response) VALUES($1,$2,$3)',[deliveryId,hash,JSON.stringify(response)]);await client.query('COMMIT');return response;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function verifiedPhone(pool:Pool,owner:string){
 const {rows:[user]}=await pool.query('SELECT phone_number FROM advocacy_phone_users WHERE phone_number_verified=true AND (id=$1 OR linked_owner_id=$2)',[owner.startsWith('phone:')?owner.slice(6):'',owner]);return user?.phone_number as string|undefined??null;
}
export async function claimPhoneIntake(pool:Pool,owner:string,id:string,consent?:boolean,startAgent=false){
 const phone=await verifiedPhone(pool,owner);if(!phone)throw Error('VERIFIED_PHONE_REQUIRED');
 return drizzle(pool).transaction(async tx=>{
  const {rows:[intake]}=await tx.execute(sql`SELECT * FROM advocacy_phone_intakes WHERE id=${id} AND phone=${phone} AND stage='portal' AND expires_at>now() FOR UPDATE`);
  if(!intake||intake.owner_id&&intake.owner_id!==owner)throw Error('INTAKE_NOT_FOUND');
  // Retries return the original case; they never expand a historical intake's authorization.
  if(intake.case_id)return intake.case_id as string;
  const title=intake.case_type==='workplace_injury'?'Workplace injury':'Health insurance claim';
  const {rows:[item]}=await tx.execute(sql`INSERT INTO advocacy_cases(owner_id,title,case_type,intake,notes) VALUES(${owner},${title},${intake.case_type},${JSON.stringify({contact_phone:phone,injury_description:intake.narrative})}::jsonb,${`Caller-reported account from phone intake. ${intake.narrative}`}) RETURNING id`);
  const caseId=item.id as string;
  await tx.execute(sql`UPDATE advocacy_phone_intakes SET owner_id=${owner},case_id=${caseId} WHERE id=${id}`);
  // Reuse call consent on first association; omitted preference never overwrites a later STOP.
  if(consent===undefined)await tx.execute(sql`INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES(${owner},${phone},${intake.sms_consent}) ON CONFLICT(owner_id) DO NOTHING`);
  else await tx.execute(sql`INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES(${owner},${phone},${consent}) ON CONFLICT(owner_id) DO UPDATE SET sms_consent=${consent},updated_at=now()`);
  if(startAgent)await authorizeCase(tx,caseId,owner,{version:2,consent:DEFAULT_INTAKE_CONSENT},undefined,true);
  return caseId;
 });
}

export async function linkVerifiedPhone(pool:Pool,owner:string,phoneUserId:string){
 if(owner.startsWith('phone:'))throw Error('EXISTING_ACCOUNT_REQUIRED');
 const client=await pool.connect();try{await client.query('BEGIN');
  const {rows:[u]}=await client.query('SELECT * FROM advocacy_phone_users WHERE id=$1 AND phone_number_verified=true FOR UPDATE',[phoneUserId]);
  if(!u||u.linked_owner_id&&u.linked_owner_id!==owner)throw Error('PHONE_ALREADY_LINKED');
  const used=await client.query('SELECT id FROM advocacy_phone_users WHERE linked_owner_id=$1 AND id<>$2',[owner,u.id]);if(used.rowCount)throw Error('ACCOUNT_ALREADY_LINKED');
  const records=await client.query('SELECT id FROM advocacy_cases WHERE owner_id=$1 LIMIT 1',[`phone:${u.id}`]);if(records.rowCount)throw Error('PHONE_ACCOUNT_HAS_CASES');
  await client.query('UPDATE advocacy_phone_users SET linked_owner_id=$2 WHERE id=$1',[u.id,owner]);
  await client.query('INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES($1,$2,false) ON CONFLICT(owner_id) DO NOTHING',[owner,u.phone_number]);
  await client.query('COMMIT');return {linked:true};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
