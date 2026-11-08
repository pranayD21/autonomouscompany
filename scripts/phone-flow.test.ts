import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHmac} from 'node:crypto';
import {Pool} from 'pg';import {drizzle} from 'drizzle-orm/node-postgres';import {migrate} from 'drizzle-orm/node-postgres/migrator';import {createLocalJWKSet,jwtVerify} from 'jose';
import {requestPhoneDocument} from '../backend/phone-document-request';
import {createPhoneAuth} from '../backend/phone-auth';import {handlePhoneEvent,claimPhoneIntake,linkVerifiedPhone,verifiedPhone} from '../backend/phone-intake';import {validPhoneWebhook,phoneOwner,deliverPhoneNotifications,enqueueDocumentNotice,sendPhoneText} from '../backend/phone-messaging';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable branch required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full'),max:6});
const captured=new Map<string,string>(),baseURL='http://localhost:4173';const auth=createPhoneAuth(pool,{baseURL,rateLimit:false,secret:'test-only-phone-auth-secret-at-least-32-characters',sendOTP:async(p,c)=>{captured.set(p,c);}});
const fixtures:string[]=[],users:string[]=[],caseIds:string[]=[];let seq=1;
const phone=()=>{const p=`+1555000${String(seq++).padStart(4,'0')}`;fixtures.push(p);return p;};
const request=(path:string,body?:unknown,token?:string)=>auth.handler(new Request(`${baseURL}/auth${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','Origin':baseURL,...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
before(async()=>{await migrate(drizzle(pool),{migrationsFolder:'drizzle'});process.env.AGENTPHONE_AGENT_ID='agt_phone_fixture';process.env.AGENTPHONE_NUMBER_ID='num_phone_fixture';});
after(async()=>{await pool.query("DELETE FROM advocacy_phone_notifications WHERE dedupe_key LIKE 'phone-test:%' OR intake_id IN(SELECT id FROM advocacy_phone_intakes WHERE call_id LIKE 'phone-test:%') OR case_id=ANY($1::uuid[])",[caseIds]);await pool.query("DELETE FROM advocacy_phone_events WHERE id LIKE 'phone-test:%'");await pool.query("DELETE FROM advocacy_phone_intakes WHERE call_id LIKE 'phone-test:%'");if(users.length){await pool.query('DELETE FROM advocacy_phone_preferences WHERE phone=ANY($1)',[fixtures]);await pool.query('DELETE FROM advocacy_cases WHERE owner_id=ANY($1)',[users.map(phoneOwner)]);await pool.query('DELETE FROM advocacy_phone_users WHERE id=ANY($1)',[users]);}await pool.query('DELETE FROM advocacy_phone_verifications WHERE identifier=ANY($1)',[fixtures.map(p=>`phone-number-otp-${p}`)]);await pool.end();});
async function signup(p=phone()){
 assert.equal((await request('/phone-number/send-otp',{phoneNumber:p})).status,200);const code=captured.get(p)!;assert.match(code,/^\d{6}$/);
 const r=await request('/phone-number/verify',{phoneNumber:p,code});assert.equal(r.status,200);const d=await r.json();users.push(d.user.id);return {...d,phone:p,code};
}
function event(p:string,callId:string,transcript:string){return JSON.stringify({event:'agent.message',channel:'voice',agentId:'agt_phone_fixture',data:{callId,numberId:'num_phone_fixture',from:p,to:'+15559990000',direction:'inbound',transcript}});}
test('phone-first signup requires OTP, returns a scoped JWT, rejects replay, and signs out',async()=>{
 const p=phone();assert.equal((await request('/phone-number/send-otp',{phoneNumber:p})).status,200);const code=captured.get(p)!;
 const wrong=code[0]==='1'?`2${code.slice(1)}`:`1${code.slice(1)}`;assert.equal((await request('/phone-number/verify',{phoneNumber:p,code:wrong})).status,400);
 const r=await request('/phone-number/verify',{phoneNumber:p,code});assert.equal(r.status,200);const d=await r.json();users.push(d.user.id);assert.equal(d.user.phoneNumberVerified,true);
 assert.notEqual((await request('/phone-number/verify',{phoneNumber:p,code})).status,200);
 const jwt=(await(await request('/token',undefined,d.token)).json()).token;assert.equal(typeof jwt,'string');const jwks=await(await request('/jwks')).json();const verified=await jwtVerify(jwt,createLocalJWKSet(jwks),{issuer:baseURL,audience:'assurance-cases',algorithms:['EdDSA']});assert.equal(verified.payload.sub,phoneOwner(d.user.id));
 assert.equal((await request('/sign-out',{},d.token)).status,200);const session=await(await request('/get-session',undefined,d.token)).json();assert.equal(session,null);
});
test('inbound intake is deduplicated and creates no account or case before verified owner review',async()=>{
 const user=await signup(),other=await signup();const call=`phone-test:${randomUUID()}`,key=`phone-test:${randomUUID()}`;
 const raw=event(user.phone,call,'yes');const response=await handlePhoneEvent(pool,key,raw);assert.deepEqual(await handlePhoneEvent(pool,key,raw),response);await assert.rejects(()=>handlePhoneEvent(pool,key,event(user.phone,call,'different')),/WEBHOOK_ID_CONFLICT/);
 await handlePhoneEvent(pool,`phone-test:${randomUUID()}`,event(user.phone,call,'workplace injury'));await handlePhoneEvent(pool,`phone-test:${randomUUID()}`,event(user.phone,call,'Fictional chemical burn at a pharmaceutical office.'));
 const {rows:[intake]}=await pool.query('SELECT * FROM advocacy_phone_intakes WHERE call_id=$1',[call]);assert.equal(intake.case_id,null);
 await assert.rejects(()=>claimPhoneIntake(pool,phoneOwner(other.user.id),intake.id,true),/INTAKE_NOT_FOUND/);
 const caseId=await claimPhoneIntake(pool,phoneOwner(user.user.id),intake.id,true);caseIds.push(caseId);assert.equal(await claimPhoneIntake(pool,phoneOwner(user.user.id),intake.id,true),caseId);
 const {rows:[c]}=await pool.query('SELECT * FROM advocacy_cases WHERE id=$1',[caseId]);assert.equal(c.owner_id,phoneOwner(user.user.id));assert.equal(c.case_type,'workplace_injury');assert.equal(c.bill_cents,null);
});
test('document problems send once, uncertain sends never repeat, and STOP cancels queued texts',async()=>{
 const user=await signup(),owner=phoneOwner(user.user.id);const {rows:[c]}=await pool.query("INSERT INTO advocacy_cases(owner_id,title) VALUES($1,'Phone notification test') RETURNING id",[owner]);caseIds.push(c.id);await pool.query('INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES($1,$2,true)',[owner,user.phone]);
 const insert=async(kind:string)=>pool.query("INSERT INTO advocacy_phone_notifications(dedupe_key,owner_id,case_id,kind,body) VALUES($1,$2,$3,'document_problem','Assurance: sign in to review a document.')",[`phone-test:${kind}:${randomUUID()}`,owner,c.id]);
 // Isolate notification dispatch from earlier fixture queues.
 await pool.query("UPDATE advocacy_phone_notifications SET state='held' WHERE state='queued'");
 await insert('once');let sends=0;const sender=async(to:string)=>{assert.equal(to,user.phone);sends++;return 'msg_fixture';};await Promise.all([deliverPhoneNotifications(pool,sender),deliverPhoneNotifications(pool,sender)]);await deliverPhoneNotifications(pool,async()=>{sends++;return 'duplicate';});assert.equal(sends,1);
 await insert('uncertain');await deliverPhoneNotifications(pool,async()=>{sends++;throw Error('Timeout');});await deliverPhoneNotifications(pool,async()=>{sends++;return 'duplicate';});assert.equal(sends,2);
 await insert('stop');await handlePhoneEvent(pool,`phone-test:${randomUUID()}`,JSON.stringify({event:'agent.message',channel:'sms',agentId:'agt_phone_fixture',data:{numberId:'num_phone_fixture',from:user.phone,direction:'inbound',message:'STOP'}}));await deliverPhoneNotifications(pool,async()=>{sends++;return 'bad';});assert.equal(sends,2);
});
test('webhook signatures bind exact bytes and reject stale timestamps',()=>{
 const body='{"test":true}',timestamp=String(Math.floor(Date.now()/1000)),secret='test_webhook_secret';const signature='sha256='+createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');const headers=new Headers({'x-webhook-timestamp':timestamp,'x-webhook-signature':signature});assert.equal(validPhoneWebhook(body,headers,secret),true);assert.equal(validPhoneWebhook(body+' ',headers,secret),false);assert.equal(validPhoneWebhook(body,headers,secret,Date.now()+600000),false);
});
test('SMS is gated before any provider send',async()=>{process.env.PHONE_FLOW_ENABLED='false';process.env.PHONE_ALLOWED_NUMBERS='+15550001111';let calls=0;await assert.rejects(()=>sendPhoneText('+15550001111','test',async()=>{calls++;return new Response();}),/SMS_NOT_READY/);assert.equal(calls,0);});

test('linking an independently verified phone preserves an existing account and rejects reassignment',async()=>{
 const u=await signup(),owner=randomUUID();assert.deepEqual(await linkVerifiedPhone(pool,owner,u.user.id),{linked:true});assert.equal(await verifiedPhone(pool,owner),u.phone);const linkedSession=await(await request('/get-session',undefined,u.token)).json();assert.equal(linkedSession.user.linkedOwnerId,owner);
 await assert.rejects(()=>linkVerifiedPhone(pool,randomUUID(),u.user.id),/PHONE_ALREADY_LINKED/);
 const {rows:[c]}=await pool.query("INSERT INTO advocacy_cases(owner_id,title) VALUES($1,'Existing account case') RETURNING id",[owner]);caseIds.push(c.id);
 const {rows:[current]}=await pool.query('SELECT owner_id FROM advocacy_cases WHERE id=$1',[c.id]);assert.equal(current.owner_id,owner);
 await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[c.id]);
});
test('document issue events deduplicate and stay held when recipient is not approved',async()=>{
 const u=await signup(),owner=phoneOwner(u.user.id);const {rows:[c]}=await pool.query("INSERT INTO advocacy_cases(owner_id,title) VALUES($1,'Document failure fixture') RETURNING id",[owner]);caseIds.push(c.id);
 await pool.query('INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES($1,$2,true)',[owner,u.phone]);process.env.PHONE_FLOW_ENABLED='true';process.env.PHONE_ALLOWED_NUMBERS='';
 const doc=randomUUID();await enqueueDocumentNotice(pool,c.id,doc,'PDF_NO_TEXT');await enqueueDocumentNotice(pool,c.id,doc,'PDF_NO_TEXT');
 const {rows}=await pool.query('SELECT * FROM advocacy_phone_notifications WHERE case_id=$1',[c.id]);assert.equal(rows.length,1);assert.equal(rows[0].state,'held');assert.equal(rows[0].body.includes('PDF_NO_TEXT'),false);assert.ok(rows[0].body.includes('https://assurance.claims/'));
 process.env.PHONE_FLOW_ENABLED='false';
});

test('phone OTP request throttling persists across auth instances',async()=>{
 await pool.query("DELETE FROM advocacy_phone_rate_limits WHERE key='no-trusted-ip|/phone-number/send-otp'");
 const p=phone(),limited=createPhoneAuth(pool,{baseURL,secret:'test-only-rate-secret-more-than-32-characters',sendOTP:async()=>{}});
 for(let n=0;n<3;n++)assert.equal((await limited.handler(new Request(`${baseURL}/auth/phone-number/send-otp`,{method:'POST',headers:{'Content-Type':'application/json',Origin:baseURL},body:JSON.stringify({phoneNumber:p})}))).status,200);
 const other=createPhoneAuth(pool,{baseURL,secret:'test-only-rate-secret-more-than-32-characters',sendOTP:async()=>{throw Error('Rate limit must stop delivery');}});
 assert.equal((await other.handler(new Request(`${baseURL}/auth/phone-number/send-otp`,{method:'POST',headers:{'Content-Type':'application/json',Origin:baseURL},body:JSON.stringify({phoneNumber:p})}))).status,429);
 await pool.query("DELETE FROM advocacy_phone_rate_limits WHERE key='no-trusted-ip|/phone-number/send-otp'");
});
test('agent document requests require same owner, active authority and text consent, and deduplicate',async()=>{
 const u=await signup(),owner=phoneOwner(u.user.id);const {rows:[c]}=await pool.query("INSERT INTO advocacy_cases(owner_id,title) VALUES($1,'Document request fixture') RETURNING id",[owner]);caseIds.push(c.id);
 const policy={synthetic:true,goal:'Gather fictional documents',contacts:[],max_decisions:3,max_outbound:0,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+3600000).toISOString()};
 const {rows:[a]}=await pool.query('INSERT INTO advocacy_case_authorities(case_id,approved_by,policy) VALUES($1,$2,$3) RETURNING id',[c.id,owner,JSON.stringify(policy)]);process.env.PHONE_FLOW_ENABLED='true';
 const identity={id:randomUUID(),case_id:c.id,owner_id:owner},input={operation_id:randomUUID(),authority_id:a.id,kind:'insurance_card' as const};
 await assert.rejects(()=>requestPhoneDocument(drizzle(pool),identity,input),/NOT_AUTHORIZED/);
 await pool.query('INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES($1,$2,true)',[owner,u.phone]);
 const first=await requestPhoneDocument(drizzle(pool),identity,input),again=await requestPhoneDocument(drizzle(pool),identity,{...input,operation_id:randomUUID()});assert.equal(first.id,again.id);assert.equal(first.state,'queued');
 await assert.rejects(()=>requestPhoneDocument(drizzle(pool),{...identity,owner_id:'other'},input),/NOT_AUTHORIZED/);
 await pool.query("UPDATE advocacy_case_authorities SET state='revoked' WHERE id=$1",[a.id]);await assert.rejects(()=>requestPhoneDocument(drizzle(pool),identity,{...input,kind:'bill'}),/NOT_AUTHORIZED/);
 await pool.query('DELETE FROM advocacy_case_authorities WHERE id=$1',[a.id]);process.env.PHONE_FLOW_ENABLED='false';
});
