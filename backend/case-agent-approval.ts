import {isNaiveAdmissionRejected} from "./naive-retry";
import {createHash} from "node:crypto";
import {and,eq} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseAgentSessions,caseAgentApprovals,caseAuthorities,caseToolCredentials,cases} from "./schema";
import {naiveClient} from "./providers/naive";
export type Pending={kind:string;tool_call_id:string;name:string;args?:Record<string,unknown>;parked_seq?:number;read_people?:true};
type Remote={status:string;stop_reason:string|null;pending_actions:Pending[]};
export type ApprovalProvider={read:(id:string)=>Promise<Remote>;confirm:(id:string,input:{tool_call_id:string;decision:"allow"|"deny";scope:"call";reason:string})=>Promise<Remote>};
const defaults:ApprovalProvider={read:id=>naiveClient().sessions.get(id),confirm:(id,input)=>naiveClient().sessions.confirmTool(id,input)};
const tools=new Set(["case_get","case_record_fact","cite_source","record_outcome","send_email","place_call","schedule_followup","request_human","stop_case"].map(x=>`assurance.${x}`));
export const pendingHash=(action:Pending)=>createHash("sha256").update(JSON.stringify(action)).digest("hex");
function supported(action:Pending,caseId:string,authorityId:string){return Number.isSafeInteger(action.parked_seq)&&action.parked_seq!>=0&&action.kind==="tool"&&tools.has(action.name)&&action.args?.case_id===caseId&&(!("authority_id" in action.args)||action.args.authority_id===authorityId);}
async function owned(db:NodePgDatabase,caseId:string,runId:string,owner:string){
 const [item]=await db.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,owner)));
 const [run]=await db.select().from(caseAgentSessions).where(and(eq(caseAgentSessions.id,runId),eq(caseAgentSessions.case_id,caseId)));
 if(!item||!run)throw Error("NOT_FOUND");
 if(!(process.env.CREW_ALLOWED_USER_IDS??"").split(",").includes(owner))throw Error("OPERATOR_REQUIRED");
 const [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,run.authority_id));
 const [credential]=await db.select().from(caseToolCredentials).where(eq(caseToolCredentials.id,run.credential_id));
 if(!run.session_id||!authority||authority.approved_by!==owner||!["active","waiting"].includes(authority.state)||new Date(authority.policy.expires_at)<=new Date()||!credential||credential.case_id!==caseId||credential.issued_by!==owner||credential.revoked_at||(credential.expires_at!==null&&credential.expires_at<=new Date()))throw Error("BINDING_NOT_ACTIVE");
 return run;
}
export async function readCaseApprovals(db:NodePgDatabase,caseId:string,runId:string,owner:string,provider:ApprovalProvider=defaults){
 const run=await owned(db,caseId,runId,owner),remote=await provider.read(run.session_id!);
 return {status:remote.status,stop_reason:remote.stop_reason,actions:remote.pending_actions.map(a=>({hash:pendingHash(a),name:a.name,args:a.args??{},supported:supported(a,caseId,run.authority_id),requires_operator:true})),history:await db.select({id:caseAgentApprovals.id,tool_name:caseAgentApprovals.tool_name,decision:caseAgentApprovals.decision,state:caseAgentApprovals.state,created_at:caseAgentApprovals.created_at}).from(caseAgentApprovals).where(eq(caseAgentApprovals.run_id,runId))};
}
export async function confirmCaseApproval(db:NodePgDatabase,caseId:string,runId:string,owner:string,hash:string,decision:"allow"|"deny",provider:ApprovalProvider=defaults){
 await owned(db,caseId,runId,owner);
 return db.transaction(async tx=>{
  // Serialize confirmations and hold the authority boundary until the provider accepts or fails.
  const [run]=await tx.select().from(caseAgentSessions).where(eq(caseAgentSessions.id,runId)).for("update");
  await tx.select().from(caseAuthorities).where(eq(caseAuthorities.id,run.authority_id)).for("update");
  await owned(tx,caseId,runId,owner);
  const [prior]=await tx.select().from(caseAgentApprovals).where(and(eq(caseAgentApprovals.run_id,runId),eq(caseAgentApprovals.pending_hash,hash)));
  if(prior){if(prior.decision!==decision)throw Error("CONFIRMATION_CONFLICT");return {state:prior.state};}
  const remote=await provider.read(run.session_id!);
  const action=remote.pending_actions.find(a=>pendingHash(a)===hash);
  if(remote.status!=="idle"||remote.stop_reason!=="awaiting_approval"||!action||!supported(action,caseId,run.authority_id))throw Error("STALE_OR_UNSUPPORTED_ACTION");
  await owned(tx,caseId,runId,owner);
  let state:"confirmed"|"uncertain"="uncertain";
  try{
   await provider.confirm(run.session_id!,{tool_call_id:action.tool_call_id,decision,scope:"call",reason:`Explicit Assurance case-owner ${owner} decision for this one action.`});state="confirmed";
  }catch(error){if(isNaiveAdmissionRejected(error))throw error;/* An uncertain confirmation is never automatically replayed. */}
  await tx.insert(caseAgentApprovals).values({run_id:runId,pending_hash:hash,tool_name:action.name,tool_call_id:action.tool_call_id,decision,approved_by:owner,state});
  await tx.update(caseAgentSessions).set(state==="confirmed"?{state:"running",reason:null,next_check_at:new Date(Date.now()+300000)}:{state:"human_required",reason:"Provider confirmation was uncertain. Inspect the existing session before taking further action.",next_check_at:null}).where(eq(caseAgentSessions.id,runId));
  return {state};
 });
}
