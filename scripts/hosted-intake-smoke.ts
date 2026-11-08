import {config} from 'dotenv';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
config({path:'.env.local',quiet:true});
const phone=new URL(process.env.PHONE_AUTH_BASE_URL!),base=phone.origin.replace('-phone.compute.','-cases.compute.');
const journal='test-results/hosted-intake-simplified.json';
async function json(url:string,body?:unknown,token?:string){const r=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://assurance.claims',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(120000)});if(!r.ok){const body=await r.json().catch(()=>({}));throw Error(`Request ${new URL(url).pathname} failed HTTP ${r.status}: ${String(body.error??body.message??"no message")}`);}return r.json();}
async function login(number:string){await json(`${phone.origin}/auth/phone-number/send-otp`,{phoneNumber:number});const verified=await json(`${phone.origin}/auth/phone-number/verify`,{phoneNumber:number,code:process.env.PHONE_TEST_CODE??'123456'});assert.ok(verified.token);return (await json(`${phone.origin}/auth/token`,undefined,verified.token)).token as string;}
async function main(){
 const existing=existsSync(journal)?JSON.parse(readFileSync(journal,'utf8')):null;
 assert.ok(!existing||process.argv.includes('--resume-existing')&&!existing.verified_at,'Existing fixture requires reconciliation.');
 const token=await login('+15555550104'),other=await login('+15555550103'),id=existing?.id??randomUUID();
 if(!existing)writeFileSync(journal,JSON.stringify({id,started_at:new Date().toISOString()}),{mode:0o600,flag:'wx'});
 let authority:string|undefined;
 try{
  const input={id,start_agent:true,title:'Hosted submission verification',case_type:'workplace_injury',intake:{injury_description:'Fictional verification fixture. No external contacts supplied. Stop immediately; no outreach.'}};
  const created=await json(`${base}/cases`,input,token);assert.equal(created.id,id);assert.equal(created.agent_started,true);
  let h=await json(`${base}/cases/${id}/autonomy`,undefined,token);assert.equal(h.sessions.length,1);authority=h.authorities[0].id;
  await json(`${base}/cases/${id}/autonomy/${authority}/revoke`,{},token);
  assert.equal((await json(`${base}/cases`,input,token)).id,id);
  h=await json(`${base}/cases/${id}/autonomy`,undefined,token);assert.equal(h.sessions.length,1);assert.equal(h.sessions[0].state,'stopped');
  const foreign=await fetch(`${base}/cases/${id}/autonomy`,{headers:{Authorization:`Bearer ${other}`}});assert.equal(foreign.status,404);
  const file='artifacts/demo-case/02-health-insurance-card.pdf',documentId=randomUUID(),body=new FormData();body.set('id',documentId);body.set('kind','insurance_card');body.set('file',new Blob([readFileSync(file)],{type:'application/pdf'}),'health-insurance-card.pdf');
  const uploaded=await fetch(`${base}/cases/${id}/documents`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});assert.ok(uploaded.ok);
  const extracted=await json(`${base}/cases/${id}/documents/${documentId}/extraction`,{},token);assert.equal(extracted.state,'ready');assert.ok(extracted.result.visible_text.length>50);assert.equal(extracted.confirmed_at,null);
  h=await json(`${base}/cases/${id}/autonomy`,undefined,token);assert.equal(h.sessions[0].state,'stopped');assert.equal((await json(`${base}/cases/${id}/actions`,undefined,token)).length,0);
  writeFileSync(journal,JSON.stringify({id,documentId,verified_at:new Date().toISOString(),stopped:true,outbound:0}),{mode:0o600});
  console.log('PASS hosted submission starts one run, retries preserve stop, owner isolation, real artifact reading without mandatory confirmation, and zero outreach.');
 }finally{if(!authority){const h=await json(`${base}/cases/${id}/autonomy`,undefined,token).catch(()=>null);authority=h?.authorities?.[0]?.id;}if(authority)await json(`${base}/cases/${id}/autonomy/${authority}/revoke`,{},token);}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'HOSTED_INTAKE_CHECK_FAILED');process.exitCode=1;});
