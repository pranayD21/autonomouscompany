import {config} from 'dotenv';
import {chromium,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,chmodSync,lstatSync,openSync,closeSync,unlinkSync} from 'node:fs';
config({path:'.env.local',quiet:true});
const site=new URL(process.env.HOSTED_PHONE_SITE_URL??'https://assurance.claims');
const phoneBase=new URL(process.env.PHONE_AUTH_BASE_URL??'');
const casesBase=new URL(process.env.VITE_CASES_API_URL??phoneBase.origin.replace('-phone.compute.','-cases.compute.'));
const journalPath='test-results/hosted-phone-real.json';
type Journal={phone:string;send_attempted_at?:string;send_http_status?:number;send_state?:string;verify_attempted_at?:string;verify_http_status?:number;dashboard_verified_at?:string;signed_out_at?:string};
class CheckFailure extends Error{constructor(readonly code:string){super(code);}}
function check(value:unknown,code:string):asserts value{if(!value)throw new CheckFailure(code);}
function privateFile(path:string){const stat=lstatSync(path);check(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0,'PRIVATE_FILE_REQUIRED');return readFileSync(path,'utf8');}
function loadJournal():Journal{const j=JSON.parse(privateFile(journalPath));check(typeof j.phone==='string'&&/^\+[1-9]\d{7,14}$/.test(j.phone),'INVALID_PRIVATE_PHONE');return j;}
function saveJournal(j:Journal){const temp=`${journalPath}.${randomUUID()}.tmp`;writeFileSync(temp,JSON.stringify(j,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(temp,journalPath);chmodSync(journalPath,0o600);}
async function phoneRequest(path:string,body?:unknown,token?:string){return fetch(new URL(`/auth${path}`,phoneBase),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:site.origin,...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000),redirect:'error'});}
async function credentials(sessionToken:string){const session=await phoneRequest('/get-session',undefined,sessionToken);check(session.ok,'SESSION_READ_FAILED');const data=await session.json();check(typeof data?.user?.id==='string','SESSION_ID_MISSING');const token=await phoneRequest('/token',undefined,sessionToken);check(token.ok,'JWT_READ_FAILED');const body=await token.json();check(typeof body?.token==='string','JWT_MISSING');return {identity:data.user.linkedOwnerId??`phone:${data.user.id}`,jwt:body.token as string,sessionToken};}
async function caseRequest(jwt:string,path:string,method='GET',body?:unknown){return fetch(new URL(path,casesBase),{method,headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json',Origin:site.origin},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000),redirect:'error'});}
async function dashboard(page:Page){await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible({timeout:60000});await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();}
async function demoLogin(page:Page,number:string){await page.goto(new URL('/#workspace',site).href);await page.getByRole('button',{name:number,exact:true}).click();await dashboard(page);const token=await page.evaluate(()=>sessionStorage.getItem('assurance-phone-session'));check(token,'DEMO_SESSION_MISSING');return credentials(token);}
async function signOut(page:Page){const nav=page.getByRole('navigation',{name:'Workspace navigation',exact:true});if(await nav.count())await nav.hover();await page.getByRole('button',{name:'Sign out',exact:true}).click();}
async function demo(){
 const browser=await chromium.launch({headless:true});const ownerContext=await browser.newContext(),otherContext=await browser.newContext();
 let owned:Awaited<ReturnType<typeof credentials>>|undefined,fixtureId:string|undefined,cleanupFailed=false;
 try{
  const page=await ownerContext.newPage();const initial=await demoLogin(page,'+15555550100');
  await signOut(page);await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('assurance-phone-session'))).toBeNull();
  owned=await demoLogin(page,'+15555550100');check(initial.identity===owned.identity,'DEMO_IDENTITY_CHANGED');
  const created=await caseRequest(owned.jwt,'/cases','POST',{title:`Fictional phone smoke ${randomUUID()}`,case_type:'health_insurance',notes:'Made-up hosted phone authentication fixture. No insurer contact or agent activation authorized.'});check(created.status===201,'DEMO_CASE_CREATE_FAILED');fixtureId=(await created.json()).id;check(typeof fixtureId==='string'&&/^[0-9a-f-]{36}$/i.test(fixtureId),'DEMO_CASE_ID_INVALID');
  const mine=await caseRequest(owned.jwt,'/cases');check(mine.ok&&(await mine.json()).some((item:{id:string})=>item.id===fixtureId),'DEMO_OWNER_CASE_MISSING');
  const otherPage=await otherContext.newPage(),other=await demoLogin(otherPage,'+15555550101');check(other.identity!==owned.identity,'DEMO_IDENTITIES_COLLIDE');
  const list=await caseRequest(other.jwt,'/cases');check(list.ok&&!(await list.json()).some((item:{id:string})=>item.id===fixtureId),'DEMO_CASE_LIST_ISOLATION_FAILED');
  const foreign=await caseRequest(other.jwt,`/cases/${fixtureId}/autonomy`);check(foreign.status===404,'DEMO_CASE_DETAIL_ISOLATION_FAILED');
  await signOut(otherPage);
  console.log('PASS hosted fictional phone sign-in, sign-out/re-sign-in stable identity, live dashboard, and two-account case isolation. No real SMS requested.');
 }finally{
  if(fixtureId&&owned){try{const removed=await caseRequest(owned.jwt,`/cases/${fixtureId}`,'DELETE');cleanupFailed=!removed.ok;}catch{cleanupFailed=true;}}
  if(owned){await phoneRequest('/sign-out',{},owned.sessionToken).catch(()=>{});}
  await browser.close();check(!cleanupFailed,'DEMO_OWN_FIXTURE_CLEANUP_FAILED');
 }
}
async function realSend(){
 // An exclusive local lock and durable attempted marker prevent concurrent or later resends.
 let lock:number;try{lock=openSync(`${journalPath}.lock`,'wx',0o600);}catch{throw new CheckFailure('REAL_SEND_LOCK_EXISTS');}
 try{
  const journal=loadJournal();check(!journal.send_attempted_at,'REAL_SEND_ALREADY_ATTEMPTED');
  const status=await fetch(new URL('/status',phoneBase),{signal:AbortSignal.timeout(15000),redirect:'error'});check(status.ok,'PHONE_STATUS_UNAVAILABLE');const readiness=await status.json();check(readiness.enabled===true&&readiness.smsReady===true,'REAL_SMS_NOT_READY');check(!Array.isArray(readiness.testNumbers)||!readiness.testNumbers.includes(journal.phone),'REAL_PHONE_IS_DEMO_NUMBER');
  journal.send_attempted_at=new Date().toISOString();journal.send_state='outcome_unknown';saveJournal(journal);
  // Do not retry this request, including after timeout or a non-2xx response.
  const response=await phoneRequest('/phone-number/send-otp',{phoneNumber:journal.phone});journal.send_http_status=response.status;journal.send_state=response.ok?'provider_request_accepted':'request_rejected_no_retry';saveJournal(journal);check(response.ok,'REAL_SEND_REJECTED_NO_RETRY');
  console.log('PASS one real OTP request accepted. Delivery and sign-in remain unverified; no resend will be attempted.');
 }finally{closeSync(lock);unlinkSync(`${journalPath}.lock`);}
}
async function realVerify(){
 const journal=loadJournal();check(!!journal.send_attempted_at,'REAL_SEND_NOT_ATTEMPTED');check(!journal.dashboard_verified_at,'REAL_ALREADY_VERIFIED');
 check(process.env.PHONE_TEST_CODE_FILE,'OTP_FILE_REQUIRED');const code=privateFile(process.env.PHONE_TEST_CODE_FILE).trim();check(/^\d{6}$/.test(code),'OTP_FILE_INVALID');
 journal.verify_attempted_at=new Date().toISOString();saveJournal(journal);
 const response=await phoneRequest('/phone-number/verify',{phoneNumber:journal.phone,code});journal.verify_http_status=response.status;saveJournal(journal);check(response.ok,'REAL_VERIFY_REJECTED');
 const data=await response.json();check(typeof data.token==='string','REAL_SESSION_MISSING');const sessionToken=data.token as string;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  const proof=await credentials(sessionToken);const identity=await caseRequest(proof.jwt,'/session');check(identity.ok&&(await identity.json()).userId===proof.identity,'REAL_API_IDENTITY_MISMATCH');
  browser=await chromium.launch({headless:true});const context=await browser.newContext();await context.addInitScript(({origin,token})=>{if(location.origin===origin){sessionStorage.setItem('assurance-phone-session',token);sessionStorage.setItem('assurance-auth-mode','phone');}},{origin:site.origin,token:sessionToken});
  const page=await context.newPage();await page.goto(new URL('/#workspace',site).href);await dashboard(page);journal.dashboard_verified_at=new Date().toISOString();saveJournal(journal);
  console.log('PASS real OTP verification, scoped API identity, and live hosted dashboard.');
 }finally{
  const ended=await phoneRequest('/sign-out',{},sessionToken).catch(()=>null);if(ended?.ok){journal.signed_out_at=new Date().toISOString();saveJournal(journal);}await browser?.close();check(ended?.ok,'REAL_SIGNOUT_FAILED');
 }
}
try{
 check(site.protocol==='https:'&&phoneBase.protocol==='https:'&&casesBase.protocol==='https:','HTTPS_REQUIRED');
 const command=process.argv[2];if(command==='demo')await demo();else if(command==='real-send')await realSend();else if(command==='real-verify')await realVerify();else throw new CheckFailure('USE_DEMO_REAL_SEND_OR_REAL_VERIFY');
}catch(error){console.error(error instanceof CheckFailure?error.code:process.argv[2]==='demo'&&error instanceof Error?error.message.slice(0,1600):'HOSTED_PHONE_CHECK_FAILED_DETAILS_SUPPRESSED');process.exitCode=1;}
