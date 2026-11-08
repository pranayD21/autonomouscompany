import {config} from "dotenv";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
config({path:[".env.local",".env"],quiet:true});
const path=process.env.ACTIVATION_SMOKE_STATE_FILE??"test-results/activation-live-smoke.json",authPath=process.env.ASSURANCE_TEST_AUTH_FILE;
if(!authPath)throw Error("Private owner authorization file required");
const state=existsSync(path)?JSON.parse(readFileSync(path,"utf8")):{title:`Synthetic activation ${randomUUID()}`};
if(state.cleaned)throw Error("Fixture already cleaned");
const save=()=>writeFileSync(path,JSON.stringify(state,null,2),{mode:0o600});save();
const base=process.env.VITE_CASES_API_URL??`https://${process.env.NEON_BRANCH_ID}-cases${process.env.NEON_FUNCTION_HOST_SUFFIX}`;
const headers={Authorization:readFileSync(authPath,"utf8").trim(),"Content-Type":"application/json"};
async function request(route:string,body?:unknown){const r=await fetch(base+route,{method:body?"POST":"GET",headers,...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(`Assurance HTTP ${r.status}: ${data.error??"request failed"}`);return data;}
const mode=process.argv[2];
if(mode==="create"){
 if(state.caseId)throw Error("Case already created; continue the existing fixture");
 const existing=(await request("/cases")).filter((c:any)=>c.title===state.title);assert.ok(existing.length<=1);
 const result=existing[0]??await request("/cases",{title:state.title,case_type:"health_insurance",bill_cents:120000,eob_cents:40000,notes:"Synthetic technical activation test. Fictional bill and EOB only. No real person, policy, insurer, or claim. Review the potential arithmetic discrepancy without claiming savings. No external communications are requested."});
 state.caseId=result.id;save();console.log("Created synthetic activation case through owner API");
}else{
 if(!state.caseId)throw Error("Create the fixture first");
 const root=`/cases/${state.caseId}`;
 if(mode==="review"){
  const review=await request(root+"/crew",{});console.log(JSON.stringify({status:review.status??"requested",saved:!!review.saved_at}));
 }else if(mode==="review-status"){
  const review=await request(root+"/crew");console.log(JSON.stringify({status:review.status,stop_reason:review.stop_reason,valid:review.output_valid,saved:!!review.saved_at}));
  if(review.output_valid&&review.saved_at){state.reviewVerified=true;save();}
 }else if(mode==="authorize"){
  assert.equal(state.reviewVerified,true,"A real saved review is required");
  const history=await request(root+"/autonomy");assert.equal(history.persistent_available,true);
  if(history.authorities.length){assert.equal(history.authorities.length,1);assert.equal(history.authorities[0].policy.max_outbound,0);state.authorityId=history.authorities[0].id;}
  else{const grant=await request(root+"/autonomy",{authorize:true,persistent:true,policy:{synthetic:true,goal:"Read this fictional case, identify missing fictional evidence, then wait. Do not contact anyone or claim a resolved outcome.",contacts:[],max_decisions:3,max_outbound:0,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+3600000).toISOString()}});state.authorityId=grant.id;}
  save();console.log("Queued one persistent authorization through owner API; zero contacts and outbound allowance");
 }else if(mode==="status"||mode==="verify"){
  const result=await request(root+"/autonomy");
  console.log(JSON.stringify({available:result.persistent_available,setups:result.setups,sessions:result.sessions}));
  if(result.sessions.length===1){state.runId=result.sessions[0].id;save();}
  if(mode==="verify"){
   assert.equal(result.setups.length,1);assert.equal(result.setups[0].state,"ready");
   assert.equal(result.setups[0].authority_id,state.authorityId);assert.equal(result.sessions.length,1);
   assert.equal(result.sessions[0].authority_id,state.authorityId);
   const approval=await request(`${root}/sessions/${state.runId}/approvals`);
   assert.ok(["running","queued","idle","completed"].includes(approval.status));
   for(const action of approval.actions)assert.equal(action.args.case_id,state.caseId);
   state.activationVerified={at:new Date().toISOString(),providerStatus:approval.status};save();
   console.log("PASS real owner review → authorization → scheduled setup → one bound provider session");
  }
 }else throw Error("Use create, review, review-status, authorize, status, or verify");
}
