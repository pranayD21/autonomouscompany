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
after(async()=>{await pool.query("DELETE FROM advocacy_phone_notifications WHERE dedupe_key LIKE 'phone-test:%' OR intake_id IN(SELECT id FROM advocacy_phone_intakes WHERE call_id LIKE 'phone-test:%') OR case_id=ANY($1::uuid[])",[caseIds]);await pool.query("DELETE FROM advocacy_phone_events WHERE id LIKE 'phone-test:%'");await pool.query("DELETE FROM advocacy_phone_intakes WHERE call_id LIKE 'phone-test:%'");if(users.length){await pool.query('DELETE FROM advocacy_phone_preferences WHERE phone=ANY($1)',[fixtures]);await pool.query('DELETE FROM advocacy_cases WHERE owner_id=ANY($1)',[users.map(phoneOwner)]);await pool.query('DELETE FROM advocacy_phone_users WHERE id=ANY($1)',[users]);}await pool.query('DELETE FROM advocacy_phone_verifications WHERE identifier=ANY($1)',[fixtures.map(p=>`phone-number-otp-${p}`)]);await pool.query('DELETE FROM advocacy_phone_rate_limits WHERE key=ANY($1)',[fixtures.map(p=>`otp-recipient:${p}`)]);await pool.end();});
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
test('document issue events deduplicate and stay held when SMS is unavailable',async()=>{
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

test('empty rollout list permits ready SMS while optional rollout restrictions remain enforced',async()=>{
 const original={enabled:process.env.PHONE_FLOW_ENABLED,allowed:process.env.PHONE_ALLOWED_NUMBERS,key:process.env.AGENTPHONE_API_KEY};
 try{
  process.env.PHONE_FLOW_ENABLED='true';process.env.PHONE_ALLOWED_NUMBERS='';process.env.AGENTPHONE_API_KEY='test-key';let sent=0;
  const transport:typeof fetch=async(input)=>{if(String(input).includes('/v1/numbers/'))return Response.json({outboundSms:'enabled'});sent++;return Response.json({id:'msg_test'});};
  assert.equal(await sendPhoneText('+15555550123','Assurance test',transport),'msg_test');assert.equal(sent,1);
  process.env.PHONE_ALLOWED_NUMBERS='+15555550999';await assert.rejects(()=>sendPhoneText('+15555550123','test',transport),/PHONE_RECIPIENT_NOT_APPROVED/);assert.equal(sent,1);
  process.env.PHONE_ALLOWED_NUMBERS='';await assert.rejects(()=>sendPhoneText('invalid','test',transport),/PHONE_RECIPIENT_INVALID/);assert.equal(sent,1);
  await assert.rejects(()=>sendPhoneText('+15555550123','test',async()=>Response.json({outboundSms:'registration_required'})),/SMS_NOT_READY/);assert.equal(sent,1);
 }finally{for(const[k,v]of Object.entries({PHONE_FLOW_ENABLED:original.enabled,PHONE_ALLOWED_NUMBERS:original.allowed,AGENTPHONE_API_KEY:original.key})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test('case notifications continue beyond the former daily cap without repeating receipts',async()=>{
 const u=await signup(),owner=phoneOwner(u.user.id);const {rows:[c]}=await pool.query("INSERT INTO advocacy_cases(owner_id,title) VALUES($1,'Notification continuity fixture') RETURNING id",[owner]);caseIds.push(c.id);
 await pool.query('INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES($1,$2,true)',[owner,u.phone]);
 await pool.query("UPDATE advocacy_phone_notifications SET state='held' WHERE state='queued'");
 for(let i=0;i<7;i++)await pool.query("INSERT INTO advocacy_phone_notifications(dedupe_key,owner_id,case_id,kind,body) VALUES($1,$2,$3,'document_problem','Assurance: review your portal')",[`phone-test:continuity:${randomUUID()}`,owner,c.id]);
 let sent=0;const sender=async()=>`msg_continuity_${++sent}`;await deliverPhoneNotifications(pool,sender);await deliverPhoneNotifications(pool,sender);assert.equal(sent,7);
 const {rows}=await pool.query('SELECT state FROM advocacy_phone_notifications WHERE case_id=$1',[c.id]);assert.ok(rows.every(r=>r.state==='submitted'));
});

test('open owner permission can request documents without a legacy synthetic expiry policy',async()=>{
 const u=await signup(),owner=phoneOwner(u.user.id);const {rows:[c]}=await pool.query("INSERT INTO advocacy_cases(owner_id,title) VALUES($1,'Open document request fixture') RETURNING id",[owner]);caseIds.push(c.id);
 const {rows:[a]}=await pool.query('INSERT INTO advocacy_case_authorities(case_id,approved_by,policy) VALUES($1,$2,$3) RETURNING id',[c.id,owner,JSON.stringify({version:2,consent:'Please gather the documents needed for my claim.'})]);
 await pool.query('INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES($1,$2,true)',[owner,u.phone]);
 process.env.PHONE_FLOW_ENABLED='true';
 try{const identity={id:randomUUID(),case_id:c.id,owner_id:owner},input={operation_id:randomUUID(),authority_id:a.id,kind:'eob' as const};
  const result=await requestPhoneDocument(drizzle(pool),identity,input);assert.equal(result.state,'queued');
  await pool.query("UPDATE advocacy_case_authorities SET state='revoked' WHERE id=$1",[a.id]);await assert.rejects(()=>requestPhoneDocument(drizzle(pool),identity,{...input,kind:'bill'}),/NOT_AUTHORIZED/);
 }finally{await pool.query('DELETE FROM advocacy_case_authorities WHERE id=$1',[a.id]);process.env.PHONE_FLOW_ENABLED='false';}
});

test('public fictional numbers use fixed OTP without provider calls and retain one-time verification',async()=>{
 const saved={provider:process.env.PHONE_SMS_PROVIDER,numbers:process.env.PHONE_TEST_NUMBERS,code:process.env.PHONE_TEST_CODE};
 try{
  process.env.PHONE_SMS_PROVIDER='twilio_verify';process.env.PHONE_TEST_NUMBERS='+15555550100,+14155550101,+14155551234,not-a-phone';process.env.PHONE_TEST_CODE='123456';
  const {phoneTestNumbers}=await import('../backend/phone-messaging');assert.deepEqual(phoneTestNumbers(),['+15555550100','+14155550101']);
  const p='+15555550100';fixtures.push(p);let sends=0;
  const demo=createPhoneAuth(pool,{baseURL,secret:'public-demo-fixture-secret-longer-than-32-characters',send:async()=>{sends++;throw Error('No provider calls for fictional test numbers');}});
  const req=(path:string,body:unknown)=>demo.handler(new Request(`${baseURL}/auth${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:baseURL},body:JSON.stringify(body)}));
  for(let n=0;n<5;n++)assert.equal((await req('/phone-number/send-otp',{phoneNumber:p})).status,200);
  assert.equal((await req('/phone-number/verify',{phoneNumber:p,code:'000000'})).status,400);
  const r=await req('/phone-number/verify',{phoneNumber:p,code:'123456'});assert.equal(r.status,200);users.push((await r.json()).user.id);
  assert.equal((await req('/phone-number/verify',{phoneNumber:p,code:'123456'})).status,400);assert.equal(sends,0);
  await assert.rejects(()=>sendPhoneText(p,'must not send',async()=>{sends++;throw Error('bad');}),/PHONE_TEST_NUMBER_NO_SMS/);assert.equal(sends,0);
 }finally{for(const[k,v]of Object.entries({PHONE_SMS_PROVIDER:saved.provider,PHONE_TEST_NUMBERS:saved.numbers,PHONE_TEST_CODE:saved.code})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('Twilio Verify uses provider OTP check, preserves attempts and rejects replay without another provider call',async()=>{
 const saved={provider:process.env.PHONE_SMS_PROVIDER,account:process.env.TWILIO_ACCOUNT_SID,token:process.env.TWILIO_AUTH_TOKEN,service:process.env.TWILIO_VERIFY_SERVICE_SID};
 try{
  process.env.PHONE_SMS_PROVIDER='twilio_verify';process.env.TWILIO_ACCOUNT_SID='AC'+'a'.repeat(32);process.env.TWILIO_AUTH_TOKEN='fixture';process.env.TWILIO_VERIFY_SERVICE_SID='VA'+'b'.repeat(32);
  let checks=0,sends=0;const transport:typeof fetch=async(input,init)=>{assert.match(String(input),/^https:\/\/verify.twilio.com\/v2\/Services\/VA/);const form=new URLSearchParams(String(init?.body));if(String(input).endsWith('/Verifications')){sends++;assert.equal(form.get('Channel'),'sms');return Response.json({status:'pending'});}checks++;return Response.json({status:form.get('Code')==='654321'?'approved':'pending'});};
  const verify=createPhoneAuth(pool,{baseURL,rateLimit:false,secret:'twilio-fixture-secret-longer-than-32-characters',send:transport});
  const req=(path:string,body:unknown)=>verify.handler(new Request(`${baseURL}/auth${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:baseURL},body:JSON.stringify(body)}));
  const p=phone();assert.equal((await req('/phone-number/send-otp',{phoneNumber:p})).status,200);assert.equal(sends,1);
  assert.equal((await req('/phone-number/verify',{phoneNumber:p,code:'111111'})).status,400);
  const r=await req('/phone-number/verify',{phoneNumber:p,code:'654321'});assert.equal(r.status,200);users.push((await r.json()).user.id);
  assert.equal((await req('/phone-number/verify',{phoneNumber:p,code:'654321'})).status,400);assert.equal(checks,2);
  const other=phone();await req('/phone-number/send-otp',{phoneNumber:other});for(let n=0;n<3;n++)assert.equal((await req('/phone-number/verify',{phoneNumber:other,code:'111111'})).status,400);const before=checks;assert.equal((await req('/phone-number/verify',{phoneNumber:other,code:'654321'})).status,400);assert.equal(checks,before);
  const {checkVerifyCode}=await import('../backend/phone-messaging');assert.equal(await checkVerifyCode(p,'654321',async()=>new Response('',{status:404})),false);
 }finally{for(const[k,v]of Object.entries({PHONE_SMS_PROVIDER:saved.provider,TWILIO_ACCOUNT_SID:saved.account,TWILIO_AUTH_TOKEN:saved.token,TWILIO_VERIFY_SERVICE_SID:saved.service})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('phone login readiness is separate from inbound flow and Verify readiness is read-only',async()=>{
 const saved={login:process.env.PHONE_LOGIN_ENABLED,flow:process.env.PHONE_FLOW_ENABLED,provider:process.env.PHONE_SMS_PROVIDER,account:process.env.TWILIO_ACCOUNT_SID,token:process.env.TWILIO_AUTH_TOKEN,service:process.env.TWILIO_VERIFY_SERVICE_SID};
 try{
  const {phoneLoginEnabled,signInSmsReady}=await import('../backend/phone-messaging');process.env.PHONE_LOGIN_ENABLED='true';process.env.PHONE_FLOW_ENABLED='false';process.env.PHONE_SMS_PROVIDER='twilio_verify';process.env.TWILIO_ACCOUNT_SID='AC'+'a'.repeat(32);process.env.TWILIO_AUTH_TOKEN='fixture';process.env.TWILIO_VERIFY_SERVICE_SID='VA'+'b'.repeat(32);assert.equal(phoneLoginEnabled(),true);
  assert.equal(await signInSmsReady(async(_input,init)=>{assert.equal(init?.method,undefined);return Response.json({sid:process.env.TWILIO_VERIFY_SERVICE_SID});}),true);
  process.env.PHONE_LOGIN_ENABLED='false';assert.equal(phoneLoginEnabled(),false);process.env.PHONE_FLOW_ENABLED='true';assert.equal(phoneLoginEnabled(),true);
  const priorKey=process.env.AGENTPHONE_API_KEY,priorAllowed=process.env.PHONE_ALLOWED_NUMBERS;process.env.AGENTPHONE_API_KEY='fixture';process.env.PHONE_ALLOWED_NUMBERS='';
  try{assert.equal(await sendPhoneText('+14155550199','Case notification',async(input)=>String(input).includes('/v1/numbers/')?Response.json({outboundSms:'enabled'}):Response.json({id:'agentphone_notification'})),'agentphone_notification');}finally{if(priorKey===undefined)delete process.env.AGENTPHONE_API_KEY;else process.env.AGENTPHONE_API_KEY=priorKey;if(priorAllowed===undefined)delete process.env.PHONE_ALLOWED_NUMBERS;else process.env.PHONE_ALLOWED_NUMBERS=priorAllowed;}

 }finally{for(const[k,v]of Object.entries({PHONE_LOGIN_ENABLED:saved.login,PHONE_FLOW_ENABLED:saved.flow,PHONE_SMS_PROVIDER:saved.provider,TWILIO_ACCOUNT_SID:saved.account,TWILIO_AUTH_TOKEN:saved.token,TWILIO_VERIFY_SERVICE_SID:saved.service})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('AgentPhone test login replaces random OTP with public code without sending',async()=>{
 const previous={provider:process.env.PHONE_SMS_PROVIDER,numbers:process.env.PHONE_TEST_NUMBERS};
 try{
  process.env.PHONE_SMS_PROVIDER='agentphone';process.env.PHONE_TEST_NUMBERS='+14155550101';const p='+14155550101';fixtures.push(p);
  const demo=createPhoneAuth(pool,{baseURL,rateLimit:false,secret:'agentphone-demo-secret-at-least-32-characters',sendOTP:async()=>{throw Error('Test must not call sender');}});
  const req=(path:string,body:unknown)=>demo.handler(new Request(`${baseURL}/auth${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:baseURL},body:JSON.stringify(body)}));
  assert.equal((await req('/phone-number/send-otp',{phoneNumber:p})).status,200);
  const result=await req('/phone-number/verify',{phoneNumber:p,code:'123456'});assert.equal(result.status,200);users.push((await result.json()).user.id);
  assert.equal((await req('/phone-number/verify',{phoneNumber:p,code:'123456'})).status,400);
 }finally{for(const[k,v]of Object.entries({PHONE_SMS_PROVIDER:previous.provider,PHONE_TEST_NUMBERS:previous.numbers})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test('phone case start is atomic, retains call text consent and never restarts a stopped case',async()=>{
 const prior=process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED;const user=await signup(),owner=phoneOwner(user.user.id),call=`phone-test:${randomUUID()}`;
 let caseId:string|undefined;
 try{
  for(const said of ['yes','workplace injury','A chemical splash injured my forearm at work.'])await handlePhoneEvent(pool,`phone-test:${randomUUID()}`,event(user.phone,call,said));
  const {rows:[intake]}=await pool.query('SELECT * FROM advocacy_phone_intakes WHERE call_id=$1',[call]);
  process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED='false';
  await assert.rejects(()=>claimPhoneIntake(pool,owner,intake.id,undefined,true),/DIRECT_ACTIVATION_UNAVAILABLE/);
  assert.equal((await pool.query('SELECT case_id FROM advocacy_phone_intakes WHERE id=$1',[intake.id])).rows[0].case_id,null);
  assert.equal((await pool.query('SELECT id FROM advocacy_cases WHERE owner_id=$1',[owner])).rowCount,0);
  // STOP remains effective even when the original call granted SMS consent.
  await pool.query('INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES($1,$2,false)',[owner,user.phone]);
  process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED='true';
  caseId=await claimPhoneIntake(pool,owner,intake.id,undefined,true);caseIds.push(caseId);
  assert.equal((await pool.query('SELECT sms_consent FROM advocacy_phone_preferences WHERE owner_id=$1',[owner])).rows[0].sms_consent,false);
  const {rows:[run]}=await pool.query('SELECT * FROM advocacy_direct_case_runs WHERE case_id=$1',[caseId]);assert.equal(run.state,'queued');assert.equal(run.owner_id,owner);
  const {revokeCaseAuthority}=await import('../backend/autonomy-service');await revokeCaseAuthority(drizzle(pool),caseId,run.authority_id,owner);
  assert.equal(await claimPhoneIntake(pool,owner,intake.id,undefined,true),caseId);
  assert.equal((await pool.query('SELECT state FROM advocacy_direct_case_runs WHERE case_id=$1',[caseId])).rows[0].state,'stopped');
  assert.equal((await pool.query('SELECT id FROM advocacy_case_authorities WHERE case_id=$1',[caseId])).rowCount,1);
 }finally{
  if(caseId)await pool.query('DELETE FROM advocacy_case_authorities WHERE case_id=$1',[caseId]);
  if(prior===undefined)delete process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED;else process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED=prior;
 }
});
