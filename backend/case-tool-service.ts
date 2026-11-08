import {readPublicSource} from "./public-source";
import {requestPhoneDocument} from "./phone-document-request";
import {recordCaseOutcome,readCaseOutcomes} from "./case-outcome";
import {takeCaseAction} from "./case-action-service";
import {caseAuthorities,documentExtractions} from "./schema";
import {citeCaseSource,publicCitation} from "./source-service";
import {caseSources} from "./schema";
import {callEvidence} from "./schema";
import {and,eq,sql,isNotNull} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseAgentFacts,cases,documents,caseReplies,outreachActions} from "./schema";
import {resolveCaseToolCredential} from "./case-tool-auth";
import type {CaseToolDependencies,CaseToolIdentity} from "./case-tools";
export function caseToolServices(db:NodePgDatabase):CaseToolDependencies{
 async function getCase(identity:CaseToolIdentity){
  const [item]=await db.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id)));
  if(!item)throw Error("NOT_FOUND");
  const files=await db.select({id:documents.id,sha256:documents.sha256}).from(documents).where(eq(documents.case_id,item.id));
  const transcriptions=await db.select({document_id:documentExtractions.document_id,result:documentExtractions.result,confirmed_at:documentExtractions.confirmed_at}).from(documentExtractions).innerJoin(documents,eq(documentExtractions.document_id,documents.id)).where(and(eq(documents.case_id,item.id),eq(documentExtractions.state,"ready")));
  const replies=await db.select().from(caseReplies).where(and(eq(caseReplies.case_id,item.id),eq(caseReplies.disposition,"accepted")));
  const actions=await db.select().from(outreachActions).where(eq(outreachActions.case_id,item.id));
  const facts=await db.select().from(caseAgentFacts).where(eq(caseAgentFacts.case_id,item.id));
  const calls=await db.select().from(callEvidence).where(eq(callEvidence.case_id,item.id));
  const sources=await db.select().from(caseSources).where(eq(caseSources.case_id,item.id));
  const authorities=await db.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,item.id));
  const outcomes=await readCaseOutcomes(db,item.id);
  return {case:item,outcomes,transcriptions:transcriptions.map(t=>({...t,trust:t.confirmed_at?"owner_confirmed_transcription":"machine_extracted_unverified"})),authorities:authorities.map(({lease_id,lease_until,...authority})=>authority),sources:sources.map(publicCitation),call_evidence:calls.map(c=>({...c,trust:"untrusted_reported_speech"})),documents:files,replies,actions,facts,evidence_refs:[...outcomes.filter(o=>o.evidence_current).map(o=>`outcome:${o.id}`),...sources.map(s=>`source:${s.id}:${s.sha256}`),...calls.map(c=>`call:${c.id}:${c.sha256}`),`case:${item.revision}`,...files.map(d=>`document:${d.id}:${d.sha256}`),...replies.map(r=>`reply:${r.id}:${r.sha256}`),...actions.map(a=>`action:${a.id}`)]};
 }
 return {readSource:async(identity,input)=>{
  const [item]=await db.select({id:cases.id}).from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id)));
  if(!item)throw Error("NOT_FOUND");return readPublicSource(input.url,input.offset);
 },requestDocument:(identity,input)=>requestPhoneDocument(db,identity,input),recordOutcome:(identity,input)=>recordCaseOutcome(db,identity,input),takeAction:(identity,input)=>takeCaseAction(db,identity,input),citeSource:(identity,input)=>citeCaseSource(db,identity,input),authenticate:token=>resolveCaseToolCredential(db,token),getCase,recordFact:async(identity,input)=>db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id))).for("update");
  if(!item)throw Error("NOT_FOUND");
  const [prior]=await tx.select().from(caseAgentFacts).where(and(eq(caseAgentFacts.case_id,item.id),eq(caseAgentFacts.operation_id,input.operation_id)));
  if(prior){if(prior.statement!==input.statement||prior.source_ref!==input.source_ref)throw Error("OPERATION_CONFLICT");return prior;}
  const context=await caseToolServices(tx).getCase(identity) as Awaited<ReturnType<typeof getCase>>;
  if(!context.evidence_refs.includes(input.source_ref))throw Error("UNKNOWN_EVIDENCE");
  const [saved]=await tx.insert(caseAgentFacts).values({case_id:item.id,credential_id:identity.id,...input}).returning();
  await tx.update(cases).set({revision:sql`${cases.revision}+1`,analysis:null,status:"new"}).where(eq(cases.id,item.id));return saved;
 })};
}
