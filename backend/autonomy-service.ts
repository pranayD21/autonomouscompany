import {openCasePermission,isOpenCasePermission} from "./open-case-policy";
import {issueCaseToolCredential} from "./case-tool-auth";
import {registerDirectCaseRun} from "./direct-case-runner";
import {directCaseRuns,caseToolCredentials,documents,documentExtractions} from "./schema";
import {readCaseOutcomes} from "./case-outcome";
import {caseSources,caseAgentFacts,caseAgentSessions,caseAgentSetups} from "./schema";
import {publicCitation} from "./source-service";
import {callEvidence} from "./schema";
import {and,desc,eq,inArray,isNotNull,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseAuthorities,caseDecisions,cases,crewRuns,outreachActions,caseReplies} from "./schema";
import {caseAuthority,type CaseAuthority} from "./autonomy-policy";
import {destinationAllowed} from "./providers/outreach";

export async function authorizeCase(db:NodePgDatabase,caseId:string,userId:string,raw:unknown,allowed=destinationAllowed,persistent=false){
 if(isOpenCasePermission(raw))return authorizeDirectCase(db,caseId,userId,raw,persistent);
 if(persistent&&process.env.NAIVE_CASE_PROVISIONING_ENABLED!=="true")throw Error("PERSISTENT_SETUP_UNAVAILABLE");
 const policy=caseAuthority.parse(raw),now=Date.now(),expiry=new Date(policy.expires_at).getTime();
 if(expiry<=now||expiry>now+30*86400000)throw Error("INVALID_EXPIRY");
 if(policy.contacts.some(c=>!allowed(c.channel,c.destination)))throw Error("CONTACT_NOT_ALLOWED");
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,userId))).for("update");
  if(!item)throw Error("NOT_FOUND");
  const [existing]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.case_id,caseId),inArray(caseAuthorities.state,["active","waiting","human_required"])));
  if(existing)throw Error("AUTHORITY_ALREADY_EXISTS");
  const [review]=await tx.select().from(crewRuns).where(and(eq(crewRuns.case_id,caseId),eq(crewRuns.case_revision,item.revision)));
  if(!review?.completed_at||!review.snapshot?.output_valid)throw Error("REVIEW_REQUIRED");
  const [created]=await tx.insert(caseAuthorities).values({case_id:caseId,policy,approved_by:userId}).returning();
  if(persistent)await tx.insert(caseAgentSetups).values({case_id:caseId,authority_id:created.id,requested_by:userId});
  return created;
 });
}

export const directActivationAvailable=()=>process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED==="true";
async function authorizeDirectCase(db:NodePgDatabase,caseId:string,userId:string,raw:unknown,persistent:boolean){
 const policy=openCasePermission.parse(raw);
 if(!persistent||!directActivationAvailable())throw Error("DIRECT_ACTIVATION_UNAVAILABLE");
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,userId))).for("update");
  if(!item)throw Error("NOT_FOUND");
  const [existing]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.case_id,caseId),inArray(caseAuthorities.state,["active","waiting","human_required"])));
  if(existing)throw Error("AUTHORITY_ALREADY_EXISTS");
  const inserted=await tx.execute(sql`INSERT INTO advocacy_case_authorities(case_id,policy,approved_by) VALUES(${caseId},${JSON.stringify(policy)}::jsonb,${userId}) RETURNING id`);
  const id=inserted.rows[0].id as string;
  const credential=await issueCaseToolCredential(tx,caseId,userId,id);
  await registerDirectCaseRun(tx,{case_id:caseId,authority_id:id,credential_id:credential.id,owner_id:userId});
  const [created]=await tx.select().from(caseAuthorities).where(eq(caseAuthorities.id,id));return created;
 });
}

export async function revokeCaseAuthority(db:NodePgDatabase,caseId:string,id:string,userId:string){
 return db.transaction(async tx=>{
  const [item]=await tx.select({id:cases.id}).from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,userId))).for("update");
  if(!item)throw Error("NOT_FOUND");
  const [revoked]=await tx.update(caseAuthorities).set({state:"revoked",next_wake_at:null,reason:"Stopped by the case owner."})
   .where(and(eq(caseAuthorities.id,id),eq(caseAuthorities.case_id,caseId),eq(caseAuthorities.approved_by,userId))).returning();
  if(!revoked)throw Error("NOT_FOUND");
  await tx.update(caseToolCredentials).set({revoked_at:new Date()}).where(eq(caseToolCredentials.authority_id,id));
  await tx.update(directCaseRuns).set({state:"stopped",next_check_at:null,lease_id:null,lease_until:null,reason:"Stopped by the case owner. An in-flight communication may still complete.",updated_at:new Date()}).where(eq(directCaseRuns.authority_id,id));
  return revoked;
 });
}

export async function resumeCaseAuthority(db:NodePgDatabase,caseId:string,id:string,userId:string){
 return db.transaction(async tx=>{
  const [item]=await tx.select({id:cases.id}).from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,userId))).for("update");
  if(!item)throw Error("NOT_FOUND");
  const [authority]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,id),eq(caseAuthorities.case_id,caseId),eq(caseAuthorities.approved_by,userId))).for("update");
  const [run]=await tx.select().from(directCaseRuns).where(and(eq(directCaseRuns.authority_id,id),eq(directCaseRuns.owner_id,userId))).for("update");
  if(!authority||!run)throw Error("NOT_FOUND");
  if(!isOpenCasePermission(authority.policy)||!["active","waiting","human_required"].includes(authority.state)||run.state!=="human_required")throw Error("NOT_RESUMABLE");
  if(run.lease_until&&run.lease_until>new Date())throw Error("RUN_BUSY");
  if(!Array.isArray(run.pending)||run.pending.some((p:unknown)=>!p||typeof p!=="object"||(p as {started?:boolean}).started!==false))throw Error("UNRESOLVED_DISPATCH");
  const unresolved=await tx.execute(sql`SELECT id FROM advocacy_outreach_actions WHERE case_id=${caseId} AND state IN ('dispatching','unknown') LIMIT 1`);
  if(unresolved.rows.length)throw Error("UNRESOLVED_DISPATCH");
  const [credential]=await tx.select().from(caseToolCredentials).where(and(eq(caseToolCredentials.id,run.credential_id),eq(caseToolCredentials.authority_id,id),eq(caseToolCredentials.case_id,caseId),eq(caseToolCredentials.issued_by,userId)));
  if(!credential||credential.revoked_at||(credential.expires_at&&credential.expires_at<=new Date()))throw Error("PERMISSION_ENDED");
  if(!Array.isArray(run.messages))throw Error("INVALID_CONVERSATION");
  const messages=[...run.messages,...run.pending.map((entry:unknown)=>{
   const pending=entry as {call?:{id?:string}};if(!pending.call?.id)throw Error("INVALID_CONVERSATION");
   return {role:"tool",tool_call_id:pending.call.id,content:JSON.stringify({not_executed:true,reason:"Owner resumed after a pause. Read the current case and reconsider this action."})};
  })];
  await tx.update(caseAuthorities).set({state:"active",next_wake_at:new Date(),reason:null}).where(eq(caseAuthorities.id,id));
  await tx.execute(sql`INSERT INTO advocacy_direct_case_events(run_id,event_key,kind,payload) VALUES(${run.id},${`owner_resume:${crypto.randomUUID()}`},'owner_resumed','{}'::jsonb)`);
  const [resumed]=await tx.update(directCaseRuns).set({state:"queued",messages,pending:[],next_check_at:new Date(),reason:null,lease_id:null,lease_until:null,updated_at:new Date()}).where(eq(directCaseRuns.id,run.id)).returning({id:directCaseRuns.id,state:directCaseRuns.state});
  return resumed;
 });
}

// A decision round sees a fixed record of the case and completed communications.
export async function caseDecisionInput(db:NodePgDatabase,caseId:string,policy:CaseAuthority){
 const [item]=await db.select().from(cases).where(eq(cases.id,caseId));if(!item)throw Error("NOT_FOUND");
 const [review]=await db.select().from(crewRuns).where(eq(crewRuns.case_id,caseId)).orderBy(desc(crewRuns.case_revision)).limit(1);
 const actions=await db.select().from(outreachActions).where(eq(outreachActions.case_id,caseId)).orderBy(desc(outreachActions.created_at)).limit(20);
 const replies=await db.select().from(caseReplies).where(and(eq(caseReplies.case_id,caseId),eq(caseReplies.disposition,"accepted"))).orderBy(desc(caseReplies.received_at)).limit(20);
 const calls=await db.select().from(callEvidence).where(eq(callEvidence.case_id,caseId)).orderBy(desc(callEvidence.received_at)).limit(20);
 const sources=await db.select().from(caseSources).where(eq(caseSources.case_id,caseId));
 const facts=await db.select().from(caseAgentFacts).where(eq(caseAgentFacts.case_id,caseId));
 const outcomes=await readCaseOutcomes(db,caseId);
 const confirmedDocuments=await db.select({id:documents.id,sha256:documents.sha256,result:documentExtractions.result}).from(documents).innerJoin(documentExtractions,eq(documentExtractions.document_id,documents.id)).where(and(eq(documents.case_id,caseId),eq(documents.state,"ready"),eq(documentExtractions.state,"ready"),isNotNull(documentExtractions.confirmed_at)));
 const extractedDocuments=isOpenCasePermission(policy)?await db.select({id:documents.id,sha256:documents.sha256,result:documentExtractions.result,confirmed_at:documentExtractions.confirmed_at}).from(documents).innerJoin(documentExtractions,eq(documentExtractions.document_id,documents.id)).where(and(eq(documents.case_id,caseId),eq(documents.state,"ready"),eq(documentExtractions.state,"ready"))):confirmedDocuments;
 const current_outcome_refs=outcomes.filter(o=>o.evidence_current).map(o=>`outcome:${o.id}`);
 const evidence_refs=[...extractedDocuments.map(d=>`document:${d.id}:${d.sha256}`),...current_outcome_refs,...sources.map(s=>`source:${s.id}:${s.sha256}`),...calls.map(c=>`call:${c.id}:${c.sha256}`),`case:${item.revision}`,...actions.map(a=>`action:${a.id}`),...replies.map(r=>`reply:${r.id}:${r.sha256}`)];
 return {case:item,authority:policy,confirmed_documents:confirmedDocuments,extracted_documents:extractedDocuments.map(d=>({...d,trust:"confirmed_at" in d&&!d.confirmed_at?"machine_extracted_unverified":"owner_confirmed_transcription"})),outcomes,current_outcome_refs,sources:sources.map(publicCitation),recorded_statements:facts,call_evidence:calls.map(c=>({...c,trust:"untrusted_reported_speech"})),review:review?.snapshot?.output_valid?{revision:review.case_revision,result:review.snapshot.result}:null,
  actions:actions.map(a=>({id:a.id,kind:a.kind,destination:a.destination,subject:a.subject,body:a.body,state:a.state,provider_status:a.provider_status,created_at:a.created_at})),
  replies:replies.map(r=>({id:r.id,sha256:r.sha256,sender:r.sender,body:r.body,received_at:r.received_at})),evidence_refs};
}

export async function readCaseAutonomy(db:NodePgDatabase,caseId:string,userId:string){
 const [item]=await db.select({id:cases.id}).from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,userId)));if(!item)throw Error("NOT_FOUND");
 const authorities=await db.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,caseId)).orderBy(desc(caseAuthorities.approved_at));
 const decisions=authorities.length?await db.select({id:caseDecisions.id,authority_id:caseDecisions.authority_id,round:caseDecisions.round,state:caseDecisions.state,decision:caseDecisions.decision,result:caseDecisions.result,action_id:caseDecisions.action_id,created_at:caseDecisions.created_at}).from(caseDecisions).where(inArray(caseDecisions.authority_id,authorities.map(a=>a.id))).orderBy(desc(caseDecisions.created_at)).limit(100):[];
 const sessions=await db.select({id:caseAgentSessions.id,authority_id:caseAgentSessions.authority_id,state:caseAgentSessions.state,next_check_at:caseAgentSessions.next_check_at,reason:caseAgentSessions.reason,created_at:caseAgentSessions.created_at}).from(caseAgentSessions).where(eq(caseAgentSessions.case_id,caseId)).orderBy(desc(caseAgentSessions.created_at));
 const setups=await db.select({id:caseAgentSetups.id,authority_id:caseAgentSetups.authority_id,state:caseAgentSetups.state,reason:caseAgentSetups.reason,created_at:caseAgentSetups.created_at}).from(caseAgentSetups).where(eq(caseAgentSetups.case_id,caseId));
 const direct=await db.select({id:directCaseRuns.id,authority_id:directCaseRuns.authority_id,state:directCaseRuns.state,next_check_at:directCaseRuns.next_check_at,reason:directCaseRuns.reason,created_at:directCaseRuns.created_at,goal:directCaseRuns.goal,finish_condition:directCaseRuns.finish_condition,last_activity_at:directCaseRuns.updated_at}).from(directCaseRuns).where(eq(directCaseRuns.case_id,caseId)).orderBy(desc(directCaseRuns.created_at));
 return {authorities,decisions,sessions:[...direct.map(r=>({...r,engine:"direct_openai",waiting_on:r.reason})),...sessions.map(r=>({...r,engine:"naive"}))],setups,activation_available:directActivationAvailable(),persistent_available:process.env.NAIVE_CASE_PROVISIONING_ENABLED==="true"};
}
