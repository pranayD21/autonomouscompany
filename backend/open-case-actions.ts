import {and,eq,inArray,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {z} from "zod";
import {caseAuthorities,caseDecisions,cases,outreachActions} from "./schema";
import {caseDecision,type CaseDecision} from "./autonomy-policy";
import {isOpenCasePermission} from "./open-case-policy";
import {caseDecisionInput} from "./autonomy-service";
import {dispatchOnce} from "./outreach-service";
import {setReplyMonitoring} from "./reply-monitor";
import type {CaseToolIdentity} from "./case-tools";
import {sendOutreach,outreachEnabled} from "./providers/outreach";
export type OpenActionInput={operation_id:string;authority_id:string;decision:CaseDecision;channel?:"email"|"call";destination?:string};
export async function takeOpenCaseAction(db:NodePgDatabase,identity:CaseToolIdentity,input:OpenActionInput,sender=sendOutreach){
 const decision=caseDecision.parse(input.decision);
 const prepared=await db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id))).for("update");
  const [authority]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,input.authority_id),eq(caseAuthorities.case_id,identity.case_id),eq(caseAuthorities.approved_by,identity.owner_id))).for("update");
  if(!authority||!item||!isOpenCasePermission(authority.policy))throw Error("INVALID_OPEN_AUTHORITY");
  const fingerprint=JSON.stringify({decision,channel:input.channel??null,destination:input.destination??null});
  const [prior]=await tx.select().from(caseDecisions).where(eq(caseDecisions.id,input.operation_id));
  if(prior){if(prior.authority_id!==authority.id||prior.input.native_tool!==true||prior.input.fingerprint!==fingerprint)throw Error("OPERATION_CONFLICT");return {authority,round:prior,send:false};}
  if(!["active","waiting"].includes(authority.state))throw Error("AUTHORITY_NOT_ACTIVE");
  const context=await caseDecisionInput(tx,item.id,authority.policy);
  if(decision.evidence_refs.some(ref=>!context.evidence_refs.includes(ref)))throw Error("UNKNOWN_EVIDENCE");
  const [uncertain]=await tx.select().from(outreachActions).where(and(eq(outreachActions.case_id,item.id),inArray(outreachActions.state,["dispatching","unknown"])));
  const [unfinished]=await tx.select({id:caseDecisions.id}).from(caseDecisions).where(and(eq(caseDecisions.authority_id,authority.id),inArray(caseDecisions.state,["executing","running","unknown"])));
  const contact=decision.tool==="contact_customer"||decision.tool==="contact_insurer";
  if((uncertain||unfinished)&&(contact||decision.tool==="stop_case"))throw Error("DISPATCH_NEEDS_RECONCILIATION");
  if(decision.tool==="stop_case"&&["goal_met","synthetic_demo_completed"].includes(decision.outcome)&&!decision.evidence_refs.some(ref=>context.current_outcome_refs.includes(ref)))throw Error("CURRENT_OUTCOME_REQUIRED");
  const [round]=await tx.insert(caseDecisions).values({id:input.operation_id,authority_id:authority.id,round:authority.decisions_used+1,case_revision:item.revision,state:contact?"executing":"finished",decision,input:{native_tool:true,fingerprint,evidence_refs:context.evidence_refs},finished_at:contact?null:new Date()}).returning();
  await tx.update(caseAuthorities).set({decisions_used:authority.decisions_used+1,observed_revision:item.revision}).where(eq(caseAuthorities.id,authority.id));
  if(contact){
   const channel=input.channel;if(!channel)throw Error("CONTACT_CHANNEL_REQUIRED");
   const destination=input.destination??decision.contact_id;
   if(!(channel==="email"?z.email().safeParse(destination).success:/^\+[1-9]\d{7,14}$/.test(destination)))throw Error("INVALID_DESTINATION");
   if(!outreachEnabled(channel))throw Error("CHANNEL_NOT_CONFIGURED");
   const [previous]=channel==="email"?await tx.select().from(outreachActions).where(and(eq(outreachActions.case_id,item.id),eq(outreachActions.kind,"email"),eq(outreachActions.destination,destination),eq(outreachActions.state,"submitted"))).orderBy(sql`${outreachActions.created_at} DESC`).limit(1):[];
   await tx.insert(outreachActions).values({id:round.id,case_id:item.id,case_revision:item.revision,kind:channel,destination,subject:previous?.provider_thread_id?`Re: ${previous.subject.replace(/^Re:\s*/i,"")}`:decision.subject,body:decision.body,reply_to_message_id:previous?.provider_thread_id?previous.provider_id:null,reply_thread_id:previous?.provider_thread_id??null});
   await tx.update(caseDecisions).set({action_id:round.id}).where(eq(caseDecisions.id,round.id));
   await tx.update(caseAuthorities).set({outbound_used:authority.outbound_used+1,last_contact_at:new Date()}).where(eq(caseAuthorities.id,authority.id));
   return {authority,round:{...round,action_id:round.id},send:true};
  }
  const state=decision.tool==="wait_for_reply"?"waiting":decision.tool==="request_human_help"?"human_required":"stopped";
  const reason=decision.tool==="request_human_help"?decision.question:decision.tool==="stop_case"?decision.summary:decision.reason;
  const result={state,reason,...(decision.tool==="stop_case"?{outcome:decision.outcome,verification:decision.outcome==="goal_met"?"evidence_reported_not_independently_verified":"not_a_verified_real_payout"}:{})};
  await tx.update(caseDecisions).set({result}).where(eq(caseDecisions.id,round.id));
  await tx.update(caseAuthorities).set({state,reason,next_wake_at:decision.tool==="wait_for_reply"?new Date(Date.now()+decision.minutes*60000):null}).where(eq(caseAuthorities.id,authority.id));
  return {authority,round:{...round,result},send:false};
 });
 if(prepared.send){
  const [action]=await db.select().from(outreachActions).where(eq(outreachActions.id,prepared.round.action_id!));
  const guard=sql`EXISTS(SELECT 1 FROM advocacy_case_authorities WHERE id=${input.authority_id} AND case_id=${identity.case_id} AND approved_by=${identity.owner_id} AND state IN ('active','waiting') AND policy->>'version'='2')`;
  const receipt=await dispatchOnce(db,action,identity.owner_id,sender,guard);
  if(receipt.state==="submitted"&&receipt.kind==="email"&&receipt.provider_thread_id)await setReplyMonitoring(db,receipt.case_id,receipt.id,identity.owner_id,true);
  await db.update(caseDecisions).set({state:"finished",finished_at:new Date(),result:{state:receipt.state,provider_id:receipt.provider_id}}).where(eq(caseDecisions.id,input.operation_id));
  if(receipt.state!=="submitted")await db.update(caseAuthorities).set({state:"human_required",reason:"Communication requires reconciliation before continuing.",next_wake_at:null}).where(and(eq(caseAuthorities.id,input.authority_id),inArray(caseAuthorities.state,["active","waiting"])));
 }
 const [round]=await db.select().from(caseDecisions).where(eq(caseDecisions.id,input.operation_id));
 const [action]=round.action_id?await db.select().from(outreachActions).where(eq(outreachActions.id,round.action_id)):[];
 return {operation_id:round.id,state:round.state,result:round.result,action:action?{id:action.id,state:action.state,provider_id:action.provider_id,provider_status:action.provider_status,error_code:action.error_code}:null};
}
