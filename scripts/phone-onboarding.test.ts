import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {extractOnboardingIntake,requestPhoneOnboarding,getPhoneOnboarding,stopPhoneOnboarding,phoneOnboardingRoutes} from '../backend/phone-onboarding';
import {Hono} from 'hono';
import {linkVerifiedPhone} from '../backend/phone-intake';
import {createPhoneAuth} from '../backend/phone-auth';
import {createLocalJWKSet,jwtVerify} from 'jose';

const goodTurns=[{role:'user' as const,text:'Workplace injury.'},{role:'agent' as const,text:'Tell me what happened.'},{role:'user' as const,text:'This is fictional. I suffered a chemical burn at the office yesterday and need help with the claim.'}];
test('only caller speech supplies the category and narrative; ambiguity and stop block creation',()=>{
 assert.equal(extractOnboardingIntake(goodTurns).sufficient,true);
 assert.equal(extractOnboardingIntake([{role:'agent',text:'Workplace injury and a serious fictional chemical burn.'}]).sufficient,false);
 assert.equal(extractOnboardingIntake([...goodTurns,{role:'user',text:'Health insurance.'}]).sufficient,false);
 assert.equal(extractOnboardingIntake([...goodTurns,{role:'user',text:"Don't start my case."}]).sufficient,false);
 assert.equal(extractOnboardingIntake([...goodTurns,{role:'user',text:'I don’t want to open this case.'}]).sufficient,false);
 assert.equal(extractOnboardingIntake([{role:'user',text:'Workplace injury.'}]).sufficient,false);
 assert.equal(extractOnboardingIntake([{role:'user',text:'This is not a workplace injury, it is not health insurance either.'}]).case_type,null);
});

const database=process.env.OUTREACH_TEST_DATABASE_URL;
if(database){
 const pool=new Pool({connectionString:database.replace('sslmode=require','sslmode=verify-full'),max:6}),owners:string[]=[],users:string[]=[];
 const env={...process.env};let setupReady=false;
 before(async()=>{await migrate(drizzle(pool),{migrationsFolder:'drizzle'});Object.assign(process.env,{PHONE_LOGIN_ENABLED:'true',PHONE_ONBOARDING_ENABLED:'true',PHONE_FLOW_ENABLED:'false',ASSURANCE_CASE_ENGINE:'naive',NAIVE_CASE_PROVISIONING_ENABLED:'true',ASSURANCE_FIRM_ENABLED:'false',AGENTPHONE_API_KEY:'mock-key',AGENTPHONE_AGENT_ID:'agt_onboard_test',AGENTPHONE_NUMBER_ID:'num_onboard_test',OUTREACH_VOICE_PROVIDER:'agentphone',PHONE_TEST_NUMBERS:''});setupReady=true;});
 after(async()=>{
  if(!setupReady){await pool.end();return;}
  await pool.query('DELETE FROM advocacy_phone_onboarding WHERE owner_id=ANY($1)',[owners]);
  await pool.query('DELETE FROM advocacy_case_agent_setups WHERE case_id IN (SELECT id FROM advocacy_cases WHERE owner_id=ANY($1))',[owners]);
  await pool.query('DELETE FROM advocacy_case_authorities WHERE case_id IN (SELECT id FROM advocacy_cases WHERE owner_id=ANY($1))',[owners]);
  await pool.query('DELETE FROM advocacy_cases WHERE owner_id=ANY($1)',[owners]);
  await pool.query('DELETE FROM advocacy_phone_users WHERE id=ANY($1)',[users]);await pool.end();
  for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);
 });
 async function owner(){const id=randomUUID(),o=`phone:${id}`,p=`+1555000${String(owners.length+1000)}`;owners.push(o);users.push(id);await pool.query('INSERT INTO advocacy_phone_users(id,name,email,phone_number,phone_number_verified) VALUES($1,$2,$3,$4,true)',[id,'Onboarding fixture',`${id}@example.invalid`,p]);return {id,owner:o,phone:p};}
 function provider(p:string,options:{timeout?:boolean;receipt?:boolean;binding?:string;status?:string;transcripts?:unknown[];rejected?:boolean}={}){
  let calls=0;const receipt=`call_${randomUUID()}`;
  const request:typeof fetch=async(url,init)=>{
   const path=String(url);assert.match(path,/^https:\/\/api\.agentphone\.ai\/v1\//);
   if(path.includes('/agents/'))return Response.json({id:'agt_onboard_test',voiceMode:'hosted',numbers:[{id:'num_onboard_test',status:'active'}]});
   if(init?.method==='POST'){
    calls++;const sent=JSON.parse(String(init.body));assert.equal(sent.toNumber,p);assert.equal(sent.disableRecording,true);assert.match(sent.systemPrompt,/separate case advocate/);assert.equal(sent.agentId,'agt_onboard_test');
    if(options.timeout)throw Error('synthetic timeout');if(options.rejected)return Response.json({error:'rejected'},{status:402});if(options.receipt===false)return Response.json({status:'queued'});return Response.json({id:receipt,status:'queued'});
   }
   assert.equal(path,`https://api.agentphone.ai/v1/calls/${receipt}`);
   return Response.json({id:receipt,agentId:'agt_onboard_test',phoneNumberId:'num_onboard_test',toNumber:options.binding??p,direction:'outbound',status:options.status??'completed',transcripts:options.transcripts??[{transcript:goodTurns[0].text,response:goodTurns[1].text},{transcript:goodTurns[2].text,response:'Your website will show the case setup result.'}]});
  };return {request,count:()=>calls};
 }
 async function due(o:string){await pool.query("UPDATE advocacy_phone_onboarding SET next_check_at=now()-interval '1 minute',lease_until=NULL WHERE owner_id=$1",[o]);}
 test('verified owner reserves one call concurrently and completion creates one isolated Naive authority without email or claim step',async()=>{
  const u=await owner(),transport=provider(u.phone);
  const results=await Promise.all([requestPhoneOnboarding(pool,u.owner,transport),requestPhoneOnboarding(pool,u.owner,transport)]);assert.equal(transport.count(),1);assert.ok(results.every(r=>['dispatching','submitted'].includes(r.status)));
  const initial=await getPhoneOnboarding(pool,u.owner,transport);assert.equal(initial.status,'active');assert.ok(initial.case_id);assert.equal(initial.transcript.length,4);
  const {rows:[c]}=await pool.query('SELECT * FROM advocacy_cases WHERE id=$1',[initial.case_id]);assert.equal(c.owner_id,u.owner);assert.equal(c.intake.contact_phone,u.phone);assert.equal(c.intake.contact_email,'');assert.match(c.notes,/fictional/);
  const authority=await pool.query('SELECT id,approved_by FROM advocacy_case_authorities WHERE case_id=$1',[c.id]);assert.equal(authority.rowCount,1);assert.equal(authority.rows[0].approved_by,u.owner);
  assert.equal((await pool.query('SELECT id FROM advocacy_case_agent_setups WHERE case_id=$1',[c.id])).rowCount,1);assert.equal((await pool.query('SELECT id FROM advocacy_direct_case_runs WHERE case_id=$1',[c.id])).rowCount,0);
  await pool.query("UPDATE advocacy_case_authorities SET state='revoked' WHERE case_id=$1",[c.id]);
  assert.equal((await requestPhoneOnboarding(pool,u.owner,transport)).case_id,c.id);assert.equal((await getPhoneOnboarding(pool,u.owner,transport)).case_id,c.id);assert.equal(transport.count(),1);assert.equal((await pool.query('SELECT state FROM advocacy_case_authorities WHERE case_id=$1',[c.id])).rows[0].state,'revoked');
 });
 test('uncertain sends and invalid receipts never redial, including repeated button presses',async()=>{
  for(const options of [{timeout:true},{receipt:false},{rejected:true}]){const u=await owner(),transport=provider(u.phone,options);const first=await requestPhoneOnboarding(pool,u.owner,transport);assert.equal(first.status,options.rejected?'failed':'unknown');await requestPhoneOnboarding(pool,u.owner,transport);await getPhoneOnboarding(pool,u.owner,transport);assert.equal(transport.count(),1);assert.equal(first.case_id,null);}
 });
 test('foreign receipt cannot become owner evidence and activation retry does not dial twice',async()=>{
  const u=await owner(),transport=provider(u.phone,{binding:'+15550009999'});await requestPhoneOnboarding(pool,u.owner,transport);const result=await getPhoneOnboarding(pool,u.owner,transport);assert.equal(result.status,'submitted');assert.equal(result.case_id,null);assert.deepEqual(result.transcript,[]);
  const v=await owner(),good=provider(v.phone);await requestPhoneOnboarding(pool,v.owner,good);process.env.NAIVE_CASE_PROVISIONING_ENABLED='false';const waiting=await getPhoneOnboarding(pool,v.owner,good);assert.equal(waiting.status,'ready');assert.equal(waiting.case_id,null);assert.ok(waiting.transcript.length);process.env.NAIVE_CASE_PROVISIONING_ENABLED='true';await due(v.owner);assert.equal((await getPhoneOnboarding(pool,v.owner,good)).status,'active');assert.equal(good.count(),1);
 });
 test('owner-bound status, scope consent, and verified phone are required',async()=>{
  const u=await owner(),v=await owner(),transport=provider(u.phone);await requestPhoneOnboarding(pool,u.owner,transport);assert.equal((await getPhoneOnboarding(pool,v.owner,transport)).status,'not_started');await assert.rejects(()=>requestPhoneOnboarding(pool,'unverified',transport),/VERIFIED_PHONE_REQUIRED/);
  const app=new Hono<{Variables:{userId:string}}>();app.use('*',async(c,next)=>{c.set('userId',v.owner);await next();});app.route('/phone/onboarding',phoneOnboardingRoutes(pool));
  assert.equal((await app.request('/phone/onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_call:true})})).status,400);
  assert.equal((await app.request('/phone/onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_call:true,accept_standard_handling:true,phone:u.phone})})).status,400);
 });
 test('incomplete transcript and caller stop preserve transcript without starting a case',async()=>{
  for(const transcripts of [[{transcript:'Hello.',response:'What type of case?'}],[{transcript:'Workplace injury.',response:'What happened?'},{transcript:'This is a fictional burn at the office. Do not start my case.',response:'I will stop.'}]]){const u=await owner(),transport=provider(u.phone,{transcripts});await requestPhoneOnboarding(pool,u.owner,transport);const result=await getPhoneOnboarding(pool,u.owner,transport);assert.equal(result.status,'needs_information');assert.equal(result.case_id,null);assert.ok(result.transcript.length);}
 });
 test('owner cancellation during dialing preserves a late receipt and prevents automatic case creation',async()=>{
  const u=await owner(),transport=provider(u.phone);let release!:()=>void,started!:()=>void;
  const barrier=new Promise<void>(resolve=>{release=resolve;}),dialing=new Promise<void>(resolve=>{started=resolve;});
  const request:typeof fetch=async(url,init)=>{if(init?.method==='POST'){started();await barrier;}return transport.request(url,init);};
  const pending=requestPhoneOnboarding(pool,u.owner,{request});await dialing;assert.equal((await stopPhoneOnboarding(pool,u.owner)).status,'cancelled');release();assert.equal((await pending).status,'cancelled');
  const result=await getPhoneOnboarding(pool,u.owner,transport);assert.equal(result.status,'cancelled');assert.equal(result.case_id,null);assert.equal(transport.count(),1);assert.ok((await pool.query('SELECT provider_id FROM advocacy_phone_onboarding WHERE owner_id=$1',[u.owner])).rows[0].provider_id);
  await requestPhoneOnboarding(pool,u.owner,transport);assert.equal(transport.count(),1);
 });
 test('stopping a created case revokes its authority and account linking cannot move a pending intake',async()=>{
  const u=await owner(),transport=provider(u.phone);await requestPhoneOnboarding(pool,u.owner,transport);await assert.rejects(()=>linkVerifiedPhone(pool,randomUUID(),u.id),/PHONE_ACCOUNT_HAS_ONBOARDING/);
  const result=await getPhoneOnboarding(pool,u.owner,transport);await stopPhoneOnboarding(pool,u.owner);assert.equal((await pool.query('SELECT state FROM advocacy_case_authorities WHERE case_id=$1',[result.case_id])).rows[0].state,'revoked');
  assert.equal((await requestPhoneOnboarding(pool,u.owner,transport)).status,'cancelled');assert.equal(transport.count(),1);
 });
 test('completed call with delayed transcript remains pending, then activates without redial',async()=>{
  const u=await owner(),options={transcripts:[] as unknown[]},transport=provider(u.phone,options);await requestPhoneOnboarding(pool,u.owner,transport);assert.equal((await getPhoneOnboarding(pool,u.owner,transport)).status,'submitted');
  options.transcripts=[{transcript:goodTurns[0].text,response:goodTurns[1].text},{transcript:goodTurns[2].text}];await due(u.owner);assert.equal((await getPhoneOnboarding(pool,u.owner,transport)).status,'active');assert.equal(transport.count(),1);
 });
 test('mocked Twilio Verify OTP yields verified phone JWT then requested call to that identity',async()=>{
  process.env.PHONE_SMS_PROVIDER='twilio_verify';const p='+15550008888';Object.assign(process.env,{TWILIO_ACCOUNT_SID:'AC_mock',TWILIO_AUTH_TOKEN:'mock',TWILIO_VERIFY_SERVICE_SID:'VA'+'b'.repeat(32)});
  const send:typeof fetch=async url=>{assert.match(String(url),/^https:\/\/verify\.twilio\.com/);return Response.json(String(url).includes('VerificationCheck')?{status:'approved'}:{sid:'VE_mock',status:'pending'});};
  // Keep this fixture's JWT encryption secret separate from any inherited test JWKS.
  const namespace=`onboarding_auth_${randomUUID().replaceAll('-','')}`;
  await pool.query(`CREATE SCHEMA ${namespace}`);
  for(const name of ['users','sessions','auth_accounts','verifications','jwks','rate_limits'])await pool.query(`CREATE TABLE ${namespace}.advocacy_phone_${name} (LIKE public.advocacy_phone_${name} INCLUDING ALL)`);
  const authPool=new Pool({connectionString:database.replace('sslmode=require','sslmode=verify-full'),options:`-c search_path=${namespace},public`,max:4});
  try{
  const auth=createPhoneAuth(authPool,{baseURL:'http://localhost:4173',secret:'onboarding-mocked-otp-secret-at-least-32-characters',rateLimit:false,send});
  const request=(path:string,body?:unknown,token?:string)=>auth.handler(new Request(`http://localhost:4173/auth${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:'http://localhost:4173',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})}));
  assert.equal((await request('/phone-number/send-otp',{phoneNumber:p})).status,200);const verified=await request('/phone-number/verify',{phoneNumber:p,code:'123456'});assert.equal(verified.status,200);const account=await verified.json();users.push(account.user.id);const o=`phone:${account.user.id}`;owners.push(o);
  const token=(await(await request('/token',undefined,account.token)).json()).token;const keys=await(await request('/jwks')).json();const claims=await jwtVerify(token,createLocalJWKSet(keys),{issuer:'http://localhost:4173',audience:'assurance-cases',algorithms:['EdDSA']});assert.equal(claims.payload.sub,o);
  const transport=provider(p);assert.equal((await requestPhoneOnboarding(authPool,o,transport)).status,'submitted');assert.equal((await getPhoneOnboarding(authPool,o,transport)).status,'active');assert.equal(transport.count(),1);
  }finally{await authPool.end();await pool.query(`DROP SCHEMA ${namespace} CASCADE`);delete process.env.PHONE_SMS_PROVIDER;}
 });
}else test('database phone onboarding integration suite requires disposable database',{skip:true},()=>{});
