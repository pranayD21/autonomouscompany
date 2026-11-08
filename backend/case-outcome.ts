import {z} from "zod";
import {and,eq,isNotNull,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {cases,caseOutcomes,documents,documentExtractions,caseReplies} from "./schema";
import type {CaseToolIdentity} from "./case-tools";
const amount=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
export const outcomeInput=z.object({
 operation_id:z.uuid(),
 summary:z.string().trim().min(1).max(2000),
 claim_decision:z.enum(["pending","accepted","partially_accepted","denied","unknown"]),
 currency:z.literal("USD"),original_responsibility_cents:amount,final_responsibility_cents:amount,
 reduction_cents:amount,refund_received_cents:amount,
 calculation_explanation:z.string().trim().min(1).max(2000),
 evidence:z.array(z.object({source_ref:z.string().min(1).max(200),quote:z.string().trim().min(8).max(2000)}).strict()).min(1).max(20),
}).strict();
export type OutcomeInput=z.infer<typeof outcomeInput>;
export async function outcomeEvidence(db:NodePgDatabase,caseId:string){
 const docs=await db.select({id:documents.id,sha256:documents.sha256,result:documentExtractions.result}).from(documents).innerJoin(documentExtractions,eq(documents.id,documentExtractions.document_id)).where(and(eq(documents.case_id,caseId),eq(documents.state,"ready"),eq(documentExtractions.state,"ready"),isNotNull(documentExtractions.confirmed_at)));
 const replies=await db.select().from(caseReplies).where(and(eq(caseReplies.case_id,caseId),eq(caseReplies.disposition,"accepted")));
 return new Map([...docs.map(d=>[`document:${d.id}:${d.sha256}`,d.result?.visible_text??""] as const),...replies.map(r=>[`reply:${r.id}:${r.sha256}`,r.body] as const)]);
}
export const outcomeEvidenceMatches=(input:OutcomeInput,evidence:Map<string,string>)=>input.evidence.every(e=>evidence.get(e.source_ref)?.includes(e.quote));
export async function recordCaseOutcome(db:NodePgDatabase,identity:CaseToolIdentity,raw:unknown){
 const input=outcomeInput.parse(raw);
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id))).for("update");
  if(!item)throw Error("NOT_FOUND");
  const [prior]=await tx.select().from(caseOutcomes).where(and(eq(caseOutcomes.case_id,item.id),eq(caseOutcomes.operation_id,input.operation_id)));
  if(prior){if(JSON.stringify(outcomeInput.parse(prior.report))!==JSON.stringify(input))throw Error("OPERATION_CONFLICT");return prior;}
  if(!outcomeEvidenceMatches(input,await outcomeEvidence(tx,item.id)))throw Error("OUTCOME_EVIDENCE_MISMATCH");
  const [saved]=await tx.insert(caseOutcomes).values({case_id:item.id,credential_id:identity.id,operation_id:input.operation_id,case_revision:item.revision,report:input}).returning();
  await tx.update(cases).set({revision:sql`${cases.revision}+1`,analysis:null,status:"new"}).where(eq(cases.id,item.id));return saved;
 });
}
export async function readCaseOutcomes(db:NodePgDatabase,caseId:string){
 const rows=await db.select().from(caseOutcomes).where(eq(caseOutcomes.case_id,caseId));
 const evidence=await outcomeEvidence(db,caseId);
 return rows.map(row=>({...row,attribution:"agent_reported" as const,evidence_current:outcomeEvidenceMatches(row.report,evidence),independently_verified:false as const}));
}
