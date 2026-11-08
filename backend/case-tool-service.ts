import {and,eq,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseAgentFacts,cases,documents,caseReplies,outreachActions} from "./schema";
import {resolveCaseToolCredential} from "./case-tool-auth";
import type {CaseToolDependencies,CaseToolIdentity} from "./case-tools";
export function caseToolServices(db:NodePgDatabase):CaseToolDependencies{
 async function getCase(identity:CaseToolIdentity){
  const [item]=await db.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id)));
  if(!item)throw Error("NOT_FOUND");
  const files=await db.select({id:documents.id,sha256:documents.sha256}).from(documents).where(eq(documents.case_id,item.id));
  const replies=await db.select().from(caseReplies).where(and(eq(caseReplies.case_id,item.id),eq(caseReplies.disposition,"accepted")));
  const actions=await db.select().from(outreachActions).where(eq(outreachActions.case_id,item.id));
  const facts=await db.select().from(caseAgentFacts).where(eq(caseAgentFacts.case_id,item.id));
  return {case:item,documents:files,replies,actions,facts,evidence_refs:[`case:${item.revision}`,...files.map(d=>`document:${d.id}:${d.sha256}`),...replies.map(r=>`reply:${r.id}:${r.sha256}`),...actions.map(a=>`action:${a.id}`)]};
 }
 return {authenticate:token=>resolveCaseToolCredential(db,token),getCase,recordFact:async(identity,input)=>db.transaction(async tx=>{
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
