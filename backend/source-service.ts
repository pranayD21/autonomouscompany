import {and,eq,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {cases,caseSources} from "./schema";
import type {CaseToolIdentity} from "./case-tools";
import {fetchPublicSource} from "./public-source";
import {normalizeEvidenceText} from "./research";
export async function citeCaseSource(db:NodePgDatabase,identity:CaseToolIdentity,input:{operation_id:string;url:string;quote:string},fetchSource=fetchPublicSource){
 const [item]=await db.select({id:cases.id}).from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id)));if(!item)throw Error("NOT_FOUND");
 const [prior]=await db.select().from(caseSources).where(and(eq(caseSources.case_id,item.id),eq(caseSources.operation_id,input.operation_id)));
 if(prior){if(prior.requested_url!==input.url||prior.quote!==normalizeEvidenceText(input.quote))throw Error("OPERATION_CONFLICT");return publicCitation(prior);}
 const source=await fetchSource(input.url,input.quote);
 return db.transaction(async tx=>{
  const [owned]=await tx.select({id:cases.id}).from(cases).where(and(eq(cases.id,item.id),eq(cases.owner_id,identity.owner_id))).for("update");if(!owned)throw Error("NOT_FOUND");
  const [sameOp]=await tx.select().from(caseSources).where(and(eq(caseSources.case_id,item.id),eq(caseSources.operation_id,input.operation_id)));
  if(sameOp){if(sameOp.requested_url!==input.url||sameOp.quote!==source.quote)throw Error("OPERATION_CONFLICT");return publicCitation(sameOp);}
  const [sameText]=await tx.select().from(caseSources).where(and(eq(caseSources.case_id,item.id),eq(caseSources.sha256,source.sha256)));
  if(sameText)throw Error("SOURCE_ALREADY_SAVED");
  const [saved]=await tx.insert(caseSources).values({case_id:item.id,operation_id:input.operation_id,...source,retrieved_at:new Date(source.retrieved_at)}).returning();
  await tx.update(cases).set({revision:sql`${cases.revision}+1`,analysis:null,status:"new"}).where(eq(cases.id,item.id));return publicCitation(saved);
 });
}
export function publicCitation(source:typeof caseSources.$inferSelect){const {text,...metadata}=source;return {...metadata,evidence_ref:`source:${source.id}:${source.sha256}`,verification:"Quote found in retrieved text. Authority, currency, relevance, and applicability remain unverified."};}
