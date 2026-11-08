import {takeOpenCaseAction} from "./open-case-actions";
import {isOpenCasePermission} from "./open-case-policy";
import {and,desc,eq,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseAuthorities,caseDecisions,cases,outreachActions} from "./schema";
import {caseDecision,type CaseDecision} from "./autonomy-policy";
import {caseDecisionInput} from "./autonomy-service";
import {applyDecision,autonomyDependencies,type AutonomyDependencies} from "./autonomy-runner";
import {mailbox} from "./providers/replies";
import type {CaseToolIdentity} from "./case-tools";

export async function takeCaseAction(db:NodePgDatabase,identity:CaseToolIdentity,input:{operation_id:string;authority_id:string;decision:CaseDecision;channel?:"email"|"call";destination?:string},deps:AutonomyDependencies=autonomyDependencies){
 const [bound]=await db.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,input.authority_id),eq(caseAuthorities.case_id,identity.case_id),eq(caseAuthorities.approved_by,identity.owner_id)));
 if(bound&&isOpenCasePermission(bound.policy))return takeOpenCaseAction(db,identity,input,deps.send);
 const decision=caseDecision.parse(input.decision),lease=randomUUID();
 const reserved=await db.transaction(async tx=>{
  const [authority]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,input.authority_id),eq(caseAuthorities.case_id,identity.case_id),eq(caseAuthorities.approved_by,identity.owner_id))).for("update");
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id))).for("update");
  if(!authority||!item)throw Error("NOT_FOUND");
  if(input.channel){
   if(decision.tool!=="contact_customer"&&decision.tool!=="contact_insurer")throw Error("INVALID_CONTACT_ACTION");
   if(authority.policy.contacts.find(c=>c.id===decision.contact_id)?.channel!==input.channel)throw Error("CONTACT_CHANNEL_MISMATCH");
  }
  const [prior]=await tx.select().from(caseDecisions).where(eq(caseDecisions.id,input.operation_id));
  if(prior&&(prior.authority_id!==authority.id||prior.input.native_tool!==true||JSON.stringify(caseDecision.parse(prior.decision))!==JSON.stringify(decision)))throw Error("OPERATION_CONFLICT");
  if(prior?.state==="finished"||prior?.state==="unknown")return {authority,round:prior,execute:false};
  if(authority.lease_until&&authority.lease_until>new Date()){
   if(prior)return {authority,round:prior,execute:false};throw Error("CASE_BUSY");
  }
  if(!["active","waiting"].includes(authority.state)||new Date(authority.policy.expires_at)<=new Date())throw Error("AUTHORITY_NOT_ACTIVE");
  let round=prior;
  if(!round){
   if(authority.decisions_used>=authority.policy.max_decisions)throw Error("DECISION_LIMIT");
   const [latest]=await tx.select().from(caseDecisions).where(eq(caseDecisions.authority_id,authority.id)).orderBy(desc(caseDecisions.round)).limit(1);
   if(latest&&latest.state!=="finished")throw Error("CASE_BUSY");
   const context=await caseDecisionInput(tx,item.id,authority.policy);
   const stopped=context.replies.some(r=>authority.policy.contacts.some(c=>c.role==="customer"&&c.channel==="email"&&mailbox(c.destination)===mailbox(r.sender))&&/\b(stop|unsubscribe|do not contact|don't contact|cancel)\b/i.test(r.body));
   [round]=await tx.insert(caseDecisions).values({id:input.operation_id,authority_id:authority.id,round:authority.decisions_used+1,case_revision:item.revision,state:"running",decision,input:{...context,native_tool:true,customer_requested_stop:stopped,verified_goal_met:false}}).returning();
   await tx.update(caseAuthorities).set({decisions_used:authority.decisions_used+1}).where(eq(caseAuthorities.id,authority.id));
  }
  await tx.update(caseAuthorities).set({lease_id:lease,lease_until:new Date(Date.now()+600000),next_wake_at:new Date()}).where(eq(caseAuthorities.id,authority.id));
  return {authority,round,execute:true};
 });
 try{if(reserved.execute)await applyDecision(db,reserved.authority,reserved.round,decision,deps);}
 finally{if(reserved.execute)await db.update(caseAuthorities).set({lease_id:null,lease_until:null}).where(and(eq(caseAuthorities.id,input.authority_id),eq(caseAuthorities.lease_id,lease)));}
 const [round]=await db.select().from(caseDecisions).where(eq(caseDecisions.id,input.operation_id));
 const [action]=round.action_id?await db.select().from(outreachActions).where(eq(outreachActions.id,round.action_id)):[];
 return {operation_id:round.id,state:round.state,result:round.result,action:action?{id:action.id,state:action.state,provider_id:action.provider_id,provider_status:action.provider_status,error_code:action.error_code}:null};
}
