import {readCaseOutcomes} from "./case-outcome";
import {and,desc,eq,inArray,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseAuthorities,caseDecisions,cases,outreachActions,caseAgentSessions} from "./schema";
import {checkCaseDecision,type CaseDecision} from "./autonomy-policy";
import {caseDecisionInput} from "./autonomy-service";
import {startCaseDecision,autonomyOutput} from "./providers/autonomy";
import {naiveClient} from "./providers/naive";
import {dispatchOnce} from "./outreach-service";
import {sendOutreach,outreachEnabled,destinationAllowed} from "./providers/outreach";
import {setReplyMonitoring} from "./reply-monitor";
import {mailbox} from "./providers/replies";

type Authority=typeof caseAuthorities.$inferSelect;
type Round=typeof caseDecisions.$inferSelect;
type DecisionSession=Pick<Awaited<ReturnType<ReturnType<typeof naiveClient>["sessions"]["get"]>>,"status"|"stop_reason"|"pending_actions"|"structured_output">;
export type AutonomyDependencies={start:(id:string,input:Record<string,unknown>)=>Promise<{id:string}>;read:(id:string)=>Promise<DecisionSession>;send:typeof sendOutreach;allowed:typeof destinationAllowed};
export const autonomyDependencies:AutonomyDependencies={start:startCaseDecision,read:id=>naiveClient().sessions.get(id),send:sendOutreach,allowed:destinationAllowed};
const live=(id:string)=>and(eq(caseAuthorities.id,id),inArray(caseAuthorities.state,["active","waiting"]));

async function finish(db:NodePgDatabase,authority:Authority,round:Round,state:Authority["state"],reason:string,nextWake:Date|null){
 await db.transaction(async tx=>{
  await tx.update(caseDecisions).set({state:"finished",finished_at:new Date(),result:{state,reason}}).where(eq(caseDecisions.id,round.id));
  await tx.update(caseAuthorities).set({state,reason,next_wake_at:nextWake,observed_revision:round.case_revision}).where(live(authority.id));
 });
}

async function executeContact(db:NodePgDatabase,authority:Authority,round:Round,deps:AutonomyDependencies){
 const [action]=await db.select().from(outreachActions).where(eq(outreachActions.id,round.action_id!));
 if(!action){await finish(db,authority,round,"human_required","Missing dispatch record; reconcile before continuing.",null);return;}
 const guard=sql`EXISTS (SELECT 1 FROM advocacy_case_authorities WHERE id=${authority.id} AND state IN ('active','waiting') AND (policy->>'expires_at')::timestamptz>now())`;
 const result=action.state==="draft"?await dispatchOnce(db,action,authority.approved_by,deps.send,guard):action;
 if(result?.state==="submitted"){
  if(result.kind==="email"&&result.provider_thread_id)await setReplyMonitoring(db,result.case_id,result.id,authority.approved_by,true);
  await finish(db,authority,round,"waiting","Message accepted by the provider; awaiting a reply, not a verified outcome.",new Date(Date.now()+authority.policy.min_contact_interval_minutes*60000));
 }else await finish(db,authority,round,"human_required",result?.state==="draft"?"Authority or case changed before dispatch.":"Dispatch needs reconciliation before another contact.",null);
}

export async function applyDecision(db:NodePgDatabase,authority:Authority,round:Round,decision:CaseDecision,deps:AutonomyDependencies){
 const prepared=await db.transaction(async tx=>{
  const [current]=await tx.select().from(caseAuthorities).where(eq(caseAuthorities.id,authority.id)).for("update");
  const [item]=await tx.select().from(cases).where(eq(cases.id,authority.case_id)).for("update");
  const [savedRound]=await tx.select().from(caseDecisions).where(eq(caseDecisions.id,round.id)).for("update");
  if(savedRound.state==="executing"||savedRound.state==="finished")return savedRound;
  if(item.revision!==round.case_revision){
   await tx.update(caseDecisions).set({state:"finished",finished_at:new Date(),result:{reason:"Case evidence changed; a fresh decision is required."}}).where(eq(caseDecisions.id,round.id));
   await tx.update(caseAuthorities).set({next_wake_at:new Date(),state:"active"}).where(live(authority.id));return null;
  }
  const [uncertain]=await tx.select({id:outreachActions.id}).from(outreachActions).where(and(eq(outreachActions.case_id,item.id),inArray(outreachActions.state,["unknown","dispatching"])));
  const input=round.input as {evidence_refs?:string[];customer_requested_stop?:boolean};
  const currentOutcomeRefs=(await readCaseOutcomes(tx,item.id)).filter(o=>o.evidence_current).map(o=>`outcome:${o.id}`);
  const denied=checkCaseDecision(current.policy,decision,{now:new Date(),revoked:!["active","waiting"].includes(current.state),decisions_used:current.decisions_used,outbound_used:current.outbound_used,last_contact_at:current.last_contact_at,evidence_refs:input.evidence_refs??[],current_outcome_refs:currentOutcomeRefs,verified_goal_met:false,customer_requested_stop:input.customer_requested_stop===true,uncertain_dispatch:!!uncertain,call_enabled:outreachEnabled("call")});
  if(denied==="CONTACT_TOO_SOON"){
   const wake=new Date(Math.min(new Date(current.policy.expires_at).getTime(),current.last_contact_at!.getTime()+current.policy.min_contact_interval_minutes*60000));
   await tx.update(caseDecisions).set({decision,state:"finished",finished_at:new Date(),result:{reason:denied,state:"waiting"}}).where(eq(caseDecisions.id,round.id));
   await tx.update(caseAuthorities).set({state:"waiting",reason:"The proposed contact was too early. A fresh decision will be made when contact is permitted.",next_wake_at:wake,observed_revision:item.revision}).where(live(current.id));return null;
  }
  if(denied){
   await tx.update(caseDecisions).set({decision,state:"finished",finished_at:new Date(),result:{reason:denied}}).where(eq(caseDecisions.id,round.id));
   await tx.update(caseAuthorities).set({state:"human_required",reason:denied,next_wake_at:null}).where(live(authority.id));return null;
  }
  if(decision.tool==="contact_customer"||decision.tool==="contact_insurer"){
   const target=current.policy.contacts.find(c=>c.id===decision.contact_id)!;
   if(!deps.allowed(target.channel,target.destination))throw Error("CONTACT_NOT_ALLOWED");
   const [priorContact]=target.channel==="email"?await tx.select().from(outreachActions).where(and(eq(outreachActions.case_id,item.id),eq(outreachActions.kind,"email"),sql`lower(${outreachActions.destination})=lower(${target.destination})`,eq(outreachActions.state,"submitted"),sql`${outreachActions.provider_id} IS NOT NULL AND ${outreachActions.provider_thread_id} IS NOT NULL`)).orderBy(desc(outreachActions.created_at)).limit(1):[];
   const [action]=await tx.insert(outreachActions).values({id:round.id,case_id:item.id,case_revision:item.revision,kind:target.channel,destination:target.destination,subject:priorContact?`Re: ${priorContact.subject.replace(/^Re:\s*/i,"")}`:decision.subject,body:`Assurance synthetic demo — fictional details only.\n\n${decision.body}`,reply_to_message_id:priorContact?.provider_id,reply_thread_id:priorContact?.provider_thread_id}).onConflictDoNothing().returning();
   if(!action)throw Error("ACTION_ID_CONFLICT");
   await tx.update(caseAuthorities).set({outbound_used:current.outbound_used+1,last_contact_at:new Date()}).where(eq(caseAuthorities.id,current.id));
   const [updated]=await tx.update(caseDecisions).set({decision,state:"executing",action_id:action.id}).where(eq(caseDecisions.id,round.id)).returning();return updated;
  }
  const state=decision.tool==="wait_for_reply"?"waiting":decision.tool==="request_human_help"?"human_required":"stopped";
  const reason=decision.tool==="request_human_help"?decision.question:decision.tool==="stop_case"?(decision.outcome==="synthetic_demo_completed"?`Synthetic scenario completed; no real payout verified. ${decision.summary}`:decision.summary):decision.reason;
  const nextWake=decision.tool==="wait_for_reply"?new Date(Date.now()+decision.minutes*60000):null;
  await tx.update(caseDecisions).set({decision,state:"finished",finished_at:new Date(),result:{state,reason}}).where(eq(caseDecisions.id,round.id));
  await tx.update(caseAuthorities).set({state,reason,next_wake_at:nextWake,observed_revision:item.revision}).where(live(current.id));return null;
 });
 if(prepared?.state==="executing")await executeContact(db,authority,prepared,deps);
}

export async function advanceCaseAuthority(db:NodePgDatabase,id:string,deps:AutonomyDependencies=autonomyDependencies){
 let [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,id));
 if(!authority||!["active","waiting"].includes(authority.state))return;
 if((authority.policy as {version?:number}).version===2)return;
 if((await db.execute(sql`SELECT id FROM advocacy_direct_case_runs WHERE authority_id=${id}`)).rows.length)return;
 if(new Date(authority.policy.expires_at)<=new Date()){
  await db.update(caseAuthorities).set({state:"stopped",reason:"Standing authorization expired.",next_wake_at:null}).where(live(id));return;
 }
 let [round]=await db.select().from(caseDecisions).where(eq(caseDecisions.authority_id,id)).orderBy(desc(caseDecisions.round)).limit(1);
 const [persistent]=await db.select({id:caseAgentSessions.id}).from(caseAgentSessions).where(eq(caseAgentSessions.authority_id,id));
 if(persistent&&(!round||round.state==="finished"||round.input.native_tool!==true))return;
 if(!round||round.state==="finished"){
  if(authority.decisions_used>=authority.policy.max_decisions){await db.update(caseAuthorities).set({state:"human_required",reason:"Agent decision limit reached; review the case before authorizing more work.",next_wake_at:null}).where(live(id));return;}
  const context=await caseDecisionInput(db,authority.case_id,authority.policy);
  const requestedStop=context.replies.some(r=>authority.policy.contacts.some(c=>c.role==="customer"&&c.channel==="email"&&mailbox(c.destination)===mailbox(r.sender))&&/\b(stop|unsubscribe|do not contact|don't contact|cancel)\b/i.test(r.body));
  if(requestedStop){await db.update(caseAuthorities).set({state:"stopped",reason:"Customer correspondence asks to stop; no further contact will be made.",next_wake_at:null}).where(live(id));return;}
  const created=await db.transaction(async tx=>{
   const [locked]=await tx.select().from(caseAuthorities).where(eq(caseAuthorities.id,id)).for("update");
   if(!["active","waiting"].includes(locked.state)||locked.decisions_used>=locked.policy.max_decisions)return null;
   const [prior]=await tx.select().from(caseDecisions).where(eq(caseDecisions.authority_id,id)).orderBy(desc(caseDecisions.round)).limit(1);
   if(prior&&prior.state!=="finished")return prior;
   const number=locked.decisions_used+1;
   const [created]=await tx.insert(caseDecisions).values({authority_id:id,round:number,case_revision:context.case.revision,input:{...context,current_time:new Date().toISOString(),next_contact_not_before:locked.last_contact_at?new Date(locked.last_contact_at.getTime()+locked.policy.min_contact_interval_minutes*60000).toISOString():null,remaining_outbound:locked.policy.max_outbound-locked.outbound_used,remaining_decisions:locked.policy.max_decisions-number,last_contact_at:locked.last_contact_at,verified_goal_met:false,customer_requested_stop:false}}).returning();
   await tx.update(caseAuthorities).set({decisions_used:number,state:"active",observed_revision:context.case.revision}).where(eq(caseAuthorities.id,id));return created;
  });
  if(!created)return;round=created;
 }
 if(round.state==="executing"){await executeContact(db,authority,round,deps);return;}
 if(round.state==="unknown")return;
 if(round.input.native_tool===true){
  if(!round.decision)throw Error("NATIVE_DECISION_MISSING");
  await applyDecision(db,authority,round,round.decision,deps);return;
 }
 if(!round.session_id){
  const session=await deps.start(round.id,round.input);
  await db.update(caseDecisions).set({session_id:session.id,state:"running"}).where(and(eq(caseDecisions.id,round.id),sql`${caseDecisions.session_id} IS NULL`));
  await db.update(caseAuthorities).set({next_wake_at:sql`date_trunc('minute',now())+interval '5 minutes'`}).where(live(id));return;
 }
 const session=await deps.read(round.session_id);
 if(session.status==="running"||session.status==="queued"||session.stop_reason==="awaiting_delegation"){
  await db.update(caseAuthorities).set({next_wake_at:sql`date_trunc('minute',now())+interval '5 minutes'`}).where(live(id));return;
 }
 const parsed=autonomyOutput.safeParse(session.structured_output);
 if(!parsed.success||session.pending_actions.length||!(session.status==="completed"||session.status==="idle"&&session.stop_reason==="end_turn")){
  await finish(db,authority,round,"human_required","The agent decision is incomplete, invalid, or needs approval. No new contact was made.",null);return;
 }
 await applyDecision(db,authority,round,parsed.data.decision,deps);
}

export async function pollAutonomousCases(db:NodePgDatabase,deps:AutonomyDependencies=autonomyDependencies){
 const stats={checked:0,failed:0};
 for(let n=0;n<3;n++){
  const claimed=await db.execute(sql`WITH due AS (
   SELECT a.id FROM advocacy_case_authorities a JOIN advocacy_cases c ON c.id=a.case_id
   WHERE a.policy->>'version' IS DISTINCT FROM '2' AND NOT EXISTS (SELECT 1 FROM advocacy_direct_case_runs r WHERE r.authority_id=a.id) AND a.state IN ('active','waiting') AND (a.next_wake_at<=now() OR (a.state='waiting' AND c.revision>a.observed_revision))
    AND (NOT EXISTS (SELECT 1 FROM advocacy_case_agent_setups p WHERE p.authority_id=a.id) OR EXISTS (SELECT 1 FROM advocacy_case_decisions d WHERE d.authority_id=a.id AND d.input->>'native_tool'='true' AND d.state IN ('running','executing')))
    AND (NOT EXISTS (SELECT 1 FROM advocacy_case_agent_sessions s WHERE s.authority_id=a.id) OR EXISTS (SELECT 1 FROM advocacy_case_decisions d WHERE d.authority_id=a.id AND d.input->>'native_tool'='true' AND d.state IN ('running','executing')))
    AND (a.lease_until IS NULL OR a.lease_until<now()) ORDER BY a.next_wake_at,a.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED
  ) UPDATE advocacy_case_authorities a SET lease_id=gen_random_uuid(),lease_until=now()+interval '10 minutes'
   FROM due WHERE a.id=due.id RETURNING a.id,a.lease_id`);
  const claim=claimed.rows[0] as {id:string;lease_id:string}|undefined;if(!claim)break;
  try{await advanceCaseAuthority(db,claim.id,deps);stats.checked++;}
  catch{await db.update(caseAuthorities).set({next_wake_at:sql`date_trunc('minute',now())+interval '15 minutes'`,reason:"Service check failed; the same decision will be reconciled before any new action."}).where(live(claim.id));stats.failed++;}
  finally{await db.update(caseAuthorities).set({lease_id:null,lease_until:null}).where(and(eq(caseAuthorities.id,claim.id),eq(caseAuthorities.lease_id,claim.lease_id)));}
 }
 return stats;
}
