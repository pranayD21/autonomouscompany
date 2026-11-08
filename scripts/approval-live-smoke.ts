import {config} from "dotenv";
import {readFileSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
config({path:[".env.local",".env"],quiet:true});
const statePath=process.env.PERSISTENT_SMOKE_STATE_FILE,authPath=process.env.ASSURANCE_TEST_AUTH_FILE;
if(!statePath||!authPath)throw Error("Explicit synthetic state file and private owner authorization file required");
const fixture=JSON.parse(readFileSync(statePath,"utf8"));
if(fixture.cleaned||!fixture.caseId||!fixture.runId)throw Error("Active synthetic fixture required");
const authorization=readFileSync(authPath,"utf8").trim();
const base=process.env.VITE_CASES_API_URL??`https://${process.env.NEON_BRANCH_ID}-cases${process.env.NEON_FUNCTION_HOST_SUFFIX}`;
async function request(path:string,body?:unknown){
 const response=await fetch(base+path,{method:body?"POST":"GET",headers:{Authorization:authorization,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();
 if(!response.ok)throw Error(`Assurance HTTP ${response.status}: ${data.error??"request failed"}`);
 return data;
}
const history=await request(`/cases/${fixture.caseId}/autonomy`);
const authority=history.authorities.find((a:any)=>a.id===fixture.authorityId);
assert.ok(authority?.policy.synthetic);assert.equal(authority.policy.max_outbound,0);assert.deepEqual(authority.policy.contacts,[]);
const path=`/cases/${fixture.caseId}/sessions/${fixture.runId}/approvals`;
const review=await request(path);
console.log(JSON.stringify({status:review.status,stop_reason:review.stop_reason,actions:review.actions.map((a:any)=>({name:a.name,supported:a.supported})),history:review.history.map((a:any)=>({decision:a.decision,state:a.state}))}));
if(process.argv[2]==="confirm"){
 assert.equal(review.status,"idle");assert.equal(review.stop_reason,"awaiting_approval");assert.equal(review.actions.length,1);
 const action=review.actions[0];assert.equal(action.supported,true);assert.equal(action.args.case_id,fixture.caseId);
 assert.ok(action.name==="assurance.case_get"||(action.name==="assurance.schedule_followup"&&action.args.authority_id===fixture.authorityId&&action.args.minutes===60),"Only the known synthetic read or 60-minute timer may be confirmed");
 const body={confirm:true,hash:action.hash,decision:"allow"};
 const result=await request(path,body);
 // An uncertain response must be investigated, never replayed automatically.
 assert.equal(result.state,"confirmed");
 const duplicate=await request(path,body);assert.equal(duplicate.state,"confirmed");
 fixture.approvalChecks=[...(fixture.approvalChecks??[]),{hash:action.hash,name:action.name,confirmedAt:new Date().toISOString(),duplicateReceipt:true}];
 writeFileSync(statePath,JSON.stringify(fixture,null,2),{mode:0o600});
 console.log("PASS deployed owner API confirmed one synthetic action; duplicate returned its recorded receipt");
}else if(process.argv[2]!=="status")throw Error("Use status or confirm");
