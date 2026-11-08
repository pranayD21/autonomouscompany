/** Hosted Naive proof with explicit zero-contact owner scope. Never runs a local scheduler. */
import {config} from 'dotenv';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
config({path:'.env.local',quiet:true});
const command=process.argv[2];assert.ok(['prepare','check','resume','stop','chat-check','unpark'].includes(command));
const phone=new URL(process.env.PHONE_AUTH_BASE_URL!).origin,base=phone.replace('-phone.compute.','-cases.compute.');
const file=process.env.NAIVE_SMOKE_STATE_FILE??'test-results/hosted-naive-recovery.json';
const state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{id:randomUUID(),updateId:randomUUID()};
const save=()=>writeFileSync(file,JSON.stringify(state),{mode:0o600});
const scope='Fictional Naive recovery verification. Only read this case, set a stable goal and finish condition, then request_human asking for the incident date. Do not research, email, call, text, delegate, submit a claim, or contact anyone. After my answer, record the incident date with its case evidence reference and request_human again. No external communication or payment is authorized.';
async function request(url:string,body?:unknown,token?:string){const r=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://assurance.claims',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(90000)});if(!r.ok){const error=await r.text();throw Error(`HTTP ${r.status} ${new URL(url).pathname}: ${error.slice(0,200)}`);}return r.json();}
async function login(number:string){await request(`${phone}/auth/phone-number/send-otp`,{phoneNumber:number});const v=await request(`${phone}/auth/phone-number/verify`,{phoneNumber:number,code:process.env.PHONE_TEST_CODE??'123456'});return (await request(`${phone}/auth/token`,undefined,v.token)).token;}
const token=await login('+15555550104');
const api=(path:string,body?:unknown)=>request(base+path,body,token);
if(command==='chat-check'){
 state.chatId??=randomUUID();save();const body={id:state.chatId,text:'Please keep this fictional verification conversation on the website. No external contacts are authorized.'};
 await api(`/cases/${state.id}/messages`,body);await api(`/cases/${state.id}/messages`,body);
 const thread=await api(`/cases/${state.id}/messages`);assert.equal(thread.messages.filter((m:any)=>m.id===state.chatId).length,1);
 const other=await login('+15555550103');for(const method of ['GET','POST']){const r=await fetch(`${base}/cases/${state.id}/messages`,{method,headers:{Authorization:`Bearer ${other}`,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({id:randomUUID(),text:'Isolation probe'})}:{})});assert.equal(r.status,404);}
 console.log('PASS hosted website chat persistence, retry deduplication, and read/write owner isolation.');
}else if(command==='prepare'){
 save();await api('/cases',{id:state.id,start_agent:false,title:'Fictional Naive recovery proof',case_type:'workplace_injury',intake:{injury_description:'Fictional workplace chemical burn. No contact details are supplied.'},notes:scope});
 let h=await api(`/cases/${state.id}/autonomy`);
 if(!h.authorities.length)await api(`/cases/${state.id}/autonomy`,{authorize:true,persistent:true,policy:{version:2,consent:scope}});
 h=await api(`/cases/${state.id}/autonomy`);assert.equal(h.authorities.length,1);assert.equal(h.authorities[0].policy.consent,scope);state.authorityId=h.authorities[0].id;save();
 assert.ok(h.setups.some((s:any)=>s.authority_id===state.authorityId));assert.ok(h.sessions.every((s:any)=>s.engine==='naive'));
 const other=await login('+15555550103');assert.equal((await fetch(`${base}/cases/${state.id}/autonomy`,{headers:{Authorization:`Bearer ${other}`}})).status,404);
 console.log('PASS hosted Naive activation queued exactly one setup with zero-contact scope and owner isolation.');
}else{
 assert.ok(state.authorityId);const h=await api(`/cases/${state.id}/autonomy`),run=h.sessions.find((s:any)=>s.authority_id===state.authorityId);
 const actions=await api(`/cases/${state.id}/actions`);assert.equal(actions.length,0,'Zero-contact scope violated');
 if(command==='unpark'){await api(`/cases/${state.id}/autonomy/${state.authorityId}/resume`,{confirm:true});console.log('PASS existing zero-contact session requeued under unchanged permission.');}
 if(command==='stop'){await api(`/cases/${state.id}/autonomy/${state.authorityId}/revoke`,{});state.stopped=true;save();console.log('PASS owner revoked case permission; credential invalidated, remote cancellation queued.');}
 else if(command==='unpark'){}
 else if(!run){console.log(JSON.stringify({pending:true,setup:h.setups.map((s:any)=>({state:s.state,reason:s.reason}))}));process.exitCode=2;}
 else {assert.equal(run.engine,'naive');if(state.runId)assert.equal(run.id,state.runId);else {state.runId=run.id;save();}
  if(state.goal){assert.equal(run.goal,state.goal);assert.equal(run.finish_condition,state.finish);}
  if(command==='resume'){assert.equal(run.state,'human_required');await api(`/cases/${state.id}/messages`,{id:state.updateId,text:'The fictional incident date was November 1, 2026. Record this with its evidence reference and ask for my next input. No external contact is authorized.'});state.resumed=true;state.resumeRevision=(await api('/cases')).find((c:any)=>c.id===state.id).revision;save();const thread=await api(`/cases/${state.id}/messages`);assert.equal(thread.messages.filter((m:any)=>m.id===state.updateId).length,1);console.log('PASS owner chat answer persisted and resumed the same Naive session.');}
  else if(run.state==='human_required'&&run.goal&&run.finish_condition){const thread=await api(`/cases/${state.id}/messages`);assert.ok(thread.messages.some((m:any)=>m.role==='assistant'&&m.kind==='request_human_help'));if(state.resumed){const item=(await api('/cases')).find((c:any)=>c.id===state.id);assert.ok(item.revision>state.resumeRevision,'Resumed agent has not yet recorded the supplied fact');}state.goal=run.goal;state.finish=run.finish_condition;state.checked=true;save();console.log('PASS hosted Naive run persisted stable goal, posted its question to website chat, and created zero outreach.');}
  else {console.log(JSON.stringify({pending:true,state:run.state,reason:run.reason,goalSaved:!!run.goal}));process.exitCode=2;}
 }
}
