import {test,before,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {macMessagesRoutes,macBridgeReady,claimMacMessage,recordMacReceipt,ingestMacReply} from '../backend/mac-messages-bridge';
import {submitCase} from '../backend/intake-service';
import {revokeCaseAuthority} from '../backend/autonomy-service';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable database required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full')}),db=drizzle(pool);
const token='mac-bridge-test-token-not-a-real-secret-123456',ids:string[]=[],owners:string[]=[],events:string[]=[];
let sequence=0;
const app=macMessagesRoutes(pool);
const post=(path:string,body:unknown={},authorization=`Bearer ${token}`)=>app.request(path,{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(body)});
async function heartbeat(){assert.equal((await post('/heartbeat',{ready:true,transport:'sms',sender_label:'Fictional test sender'})).status,200);}
async function fixture(options:{owner?:string;phone?:string;consent?:boolean}={}){
 const owner=options.owner??randomUUID(),phone=options.phone??`+120255501${String(sequence++).padStart(2,'0')}`;if(!owners.includes(owner))owners.push(owner);
 const id=randomUUID();ids.push(id);await submitCase(db,owner,{title:'Mac bridge fixture',case_type:'workplace_injury',intake:{injury_description:'Fictional fixture; fake transports only.'}},true,id);
 await pool.query('INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES($1,$2,$3) ON CONFLICT(owner_id) DO UPDATE SET sms_consent=$3',[owner,phone,options.consent??true]);
 const {rows:[authority]}=await pool.query('SELECT id FROM advocacy_case_authorities WHERE case_id=$1',[id]);
 const notification=await queue(id,owner);return {id,owner,phone,authority:authority.id,notification};
}
async function queue(caseId:string,owner:string){const {rows:[n]}=await pool.query("INSERT INTO advocacy_phone_notifications(dedupe_key,owner_id,case_id,kind,body) VALUES($1,$2,$3,'document_request','Assurance: upload your document. Reply STOP to stop.') RETURNING id",[randomUUID(),owner,caseId]);return n.id as string;}
async function sent(f:Awaited<ReturnType<typeof fixture>>){const {job}=await claimMacMessage(pool);assert.equal(job?.id,f.notification);await recordMacReceipt(pool,{id:job!.id,attempt_id:job!.attempt_id,state:'submitted',provider_id:randomUUID()});return job!;}
function reply(phone:string,text='The incident was Tuesday.'){const event_id=randomUUID();events.push(event_id);return {event_id,from:phone,text,received_at:new Date().toISOString()};}
before(async()=>{
 await migrate(db,{migrationsFolder:'drizzle'});
 Object.assign(process.env,{ASSURANCE_DIRECT_ACTIVATION_ENABLED:'true',MAC_MESSAGES_BRIDGE_ENABLED:'true',PHONE_NOTIFICATION_PROVIDER:'mac_messages',PHONE_FLOW_ENABLED:'true',MAC_MESSAGES_BRIDGE_TOKEN:token,MAC_MESSAGES_TRANSPORT:'sms',MAC_MESSAGES_SENDER_LABEL:'Fictional test sender',PHONE_ALLOWED_NUMBERS:'',PHONE_TEST_NUMBERS:''});
 const {rows:[r]}=await pool.query("SELECT count(*)::int AS count FROM advocacy_phone_notifications WHERE state='queued'");assert.equal(r.count,0,'Disposable branch contains unrelated queued notifications; reconcile before running');await heartbeat();
});
afterEach(async()=>{
 for(const id of ids.splice(0)){await pool.query('DELETE FROM advocacy_mac_bridge_inbound WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_mac_bridge_deliveries WHERE notification_id IN(SELECT id FROM advocacy_phone_notifications WHERE case_id=$1)',[id]);await pool.query('DELETE FROM advocacy_phone_notifications WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_case_authorities WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[id]);}
 for(const event of events.splice(0))await pool.query('DELETE FROM advocacy_mac_bridge_inbound WHERE event_id=$1',[event]);
 for(const owner of owners.splice(0))await pool.query('DELETE FROM advocacy_phone_preferences WHERE owner_id=$1',[owner]);
 process.env.MAC_MESSAGES_BRIDGE_ENABLED='true';process.env.PHONE_FLOW_ENABLED='true';process.env.PHONE_TEST_NUMBERS='';process.env.PHONE_ALLOWED_NUMBERS='';await heartbeat();
});
after(async()=>{await pool.query("DELETE FROM advocacy_mac_bridge_status WHERE id='primary' AND sender_label='Fictional test sender'");await pool.end();});
test('bridge rejects bad credentials and disabled operation; readiness requires matching fresh heartbeat',async()=>{
 assert.equal((await post('/claim',{},'Bearer wrong')).status,401);
 assert.equal((await post('/claim',{},token)).status,401);
 assert.equal((await post('/claim',{},`Bearer ${'é'.repeat(token.length)}`)).status,401);
 process.env.MAC_MESSAGES_BRIDGE_ENABLED='false';assert.equal((await post('/claim')).status,503);assert.equal(await macBridgeReady(pool),false);process.env.MAC_MESSAGES_BRIDGE_ENABLED='true';
 assert.equal((await post('/heartbeat',{ready:true,transport:'imessage',sender_label:'Fictional test sender'})).status,409);
 assert.equal((await post('/heartbeat',{ready:true,transport:'sms',sender_label:'Another account'})).status,409);
 await pool.query("UPDATE advocacy_mac_bridge_status SET seen_at=now()-interval '2 minutes'");assert.equal(await macBridgeReady(pool),false);await heartbeat();assert.equal(await macBridgeReady(pool),true);
});
test('concurrent claims reserve one attempt and receipt retry cannot alter it',async()=>{
 const f=await fixture();const results=await Promise.all([claimMacMessage(pool),claimMacMessage(pool)]);const jobs=results.flatMap(r=>r.job?[r.job]:[]);assert.equal(jobs.length,1);assert.equal(jobs[0].id,f.notification);
 const receipt={id:jobs[0].id,attempt_id:jobs[0].attempt_id,state:'submitted' as const,provider_id:'fake-message-guid'};await recordMacReceipt(pool,receipt);await recordMacReceipt(pool,receipt);
 assert.equal((await claimMacMessage(pool)).job,null);
 await assert.rejects(()=>recordMacReceipt(pool,{...receipt,provider_id:'different'}),/RECEIPT_CONFLICT/);
 await assert.rejects(()=>recordMacReceipt(pool,{...receipt,attempt_id:randomUUID()}),/RECEIPT_NOT_FOUND/);
});
test('missing consent and revoked authority cancel before claim; disabled phone flow leaves queue intact',async()=>{
 const f=await fixture({consent:false});assert.equal((await claimMacMessage(pool)).job,null);assert.equal((await pool.query('SELECT state FROM advocacy_phone_notifications WHERE id=$1',[f.notification])).rows[0].state,'cancelled');
 await pool.query('UPDATE advocacy_phone_preferences SET sms_consent=true WHERE owner_id=$1',[f.owner]);const n=await queue(f.id,f.owner);await revokeCaseAuthority(db,f.id,f.authority,f.owner);assert.equal((await claimMacMessage(pool)).job,null);assert.equal((await pool.query('SELECT state FROM advocacy_phone_notifications WHERE id=$1',[n])).rows[0].state,'cancelled');
 const other=await fixture();process.env.PHONE_FLOW_ENABLED='false';assert.equal((await claimMacMessage(pool)).job,null);assert.equal((await pool.query('SELECT state FROM advocacy_phone_notifications WHERE id=$1',[other.notification])).rows[0].state,'queued');
});
test('overdue attempt becomes unknown and blocks later sends to the same recipient',async()=>{
 const f=await fixture();const {job}=await claimMacMessage(pool);assert.ok(job);await queue(f.id,f.owner);await pool.query("UPDATE advocacy_mac_bridge_deliveries SET claimed_at=now()-interval '3 minutes' WHERE notification_id=$1",[f.notification]);
 assert.equal((await claimMacMessage(pool)).job,null);assert.equal((await pool.query('SELECT state FROM advocacy_phone_notifications WHERE id=$1',[f.notification])).rows[0].state,'unknown');
 assert.equal((await claimMacMessage(pool)).job,null);assert.equal((await pool.query('SELECT count(*)::int AS count FROM advocacy_mac_bridge_deliveries WHERE destination=$1',[f.phone])).rows[0].count,1);
 await recordMacReceipt(pool,{id:job.id,attempt_id:job.attempt_id,state:'submitted',provider_id:'durable-local-receipt'});assert.ok((await claimMacMessage(pool)).job);
});
test('a blocked recipient does not starve another queued recipient',async()=>{
 const blocked=await fixture();const {job}=await claimMacMessage(pool);assert.ok(job);
 await recordMacReceipt(pool,{id:job.id,attempt_id:job.attempt_id,state:'unknown',reason:'Ambiguous local send'});
 const pending=await queue(blocked.id,blocked.owner);const unrelated=await fixture();
 const next=await claimMacMessage(pool);assert.equal(next.job?.id,unrelated.notification);
 assert.equal((await pool.query('SELECT state FROM advocacy_phone_notifications WHERE id=$1',[pending])).rows[0].state,'queued');
 assert.equal((await pool.query('SELECT state FROM advocacy_mac_bridge_deliveries WHERE notification_id=$1',[blocked.notification])).rows[0].state,'unknown');
});
test('untracked personal messages are not stored and malformed/future payloads are rejected',async()=>{
 const input=reply('+12025551999');assert.equal((await ingestMacReply(pool,input)).disposition,'ignored_untracked');assert.equal((await pool.query('SELECT event_id FROM advocacy_mac_bridge_inbound WHERE event_id=$1',[input.event_id])).rowCount,0);
 assert.equal((await post('/inbound',{...input,received_at:new Date(Date.now()+120000).toISOString()})).status,400);
 assert.equal((await post('/inbound',{...input,from:'not-a-phone'})).status,400);
});
test('accepted reply advances only its case once, queues evidence, and leaves human-help paused',async()=>{
 const f=await fixture(),other=await fixture();await sent(f);await pool.query("UPDATE advocacy_direct_case_runs SET state='human_required',reason='Need owner input' WHERE case_id=$1",[f.id]);
 const input=reply(f.phone);assert.equal((await ingestMacReply(pool,input)).disposition,'accepted');assert.equal((await ingestMacReply(pool,input)).disposition,'accepted');
 await assert.rejects(()=>ingestMacReply(pool,{...input,text:'Conflicting text'}),/EVENT_CONFLICT/);
 assert.equal((await pool.query('SELECT revision FROM advocacy_cases WHERE id=$1',[f.id])).rows[0].revision,2);assert.equal((await pool.query('SELECT revision FROM advocacy_cases WHERE id=$1',[other.id])).rows[0].revision,1);
 assert.equal((await pool.query('SELECT state FROM advocacy_direct_case_runs WHERE case_id=$1',[f.id])).rows[0].state,'human_required');
 assert.equal((await pool.query("SELECT count(*)::int AS count FROM advocacy_direct_case_events e JOIN advocacy_direct_case_runs r ON r.id=e.run_id WHERE r.case_id=$1 AND e.kind='phone_reply'",[f.id])).rows[0].count,1);
});
test('two active cases for the contacted owner hold an ambiguous reply without updating either case',async()=>{
 const first=await fixture();await sent(first);const second=await fixture({owner:first.owner,phone:first.phone});await sent(second);
 const input=reply(first.phone);assert.equal((await ingestMacReply(pool,input)).disposition,'held_ambiguous');
 const rows=(await pool.query('SELECT revision FROM advocacy_cases WHERE id=ANY($1::uuid[])',[[first.id,second.id]])).rows;assert.ok(rows.every(r=>r.revision===1));
 assert.equal((await pool.query('SELECT case_id FROM advocacy_mac_bridge_inbound WHERE event_id=$1',[input.event_id])).rows[0].case_id,null);
});
test('STOP revokes text preference and cancels queued work without touching another recipient',async()=>{
 const f=await fixture();await sent(f);const queued=await queue(f.id,f.owner),other=await fixture();
 assert.equal((await ingestMacReply(pool,reply(f.phone,'STOP'))).disposition,'opt_out');
 assert.equal((await pool.query('SELECT sms_consent FROM advocacy_phone_preferences WHERE owner_id=$1',[f.owner])).rows[0].sms_consent,false);
 assert.equal((await pool.query('SELECT state FROM advocacy_phone_notifications WHERE id=$1',[queued])).rows[0].state,'cancelled');
 assert.equal((await pool.query('SELECT sms_consent FROM advocacy_phone_preferences WHERE owner_id=$1',[other.owner])).rows[0].sms_consent,true);
});
