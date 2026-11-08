import {and,eq,inArray,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {cases,outreachActions,callEvidence,caseAuthorities} from "./schema";
import {readCallEvidence,type CallEvidence} from "./providers/call-evidence";
export async function importCallEvidence(db:NodePgDatabase,caseId:string,actionId:string,owner:string,read=readCallEvidence){
 const [action]=await db.select({action:outreachActions}).from(outreachActions).innerJoin(cases,eq(cases.id,outreachActions.case_id)).where(and(eq(cases.id,caseId),eq(cases.owner_id,owner),eq(outreachActions.id,actionId)));
 if(!action)throw Error("NOT_FOUND");
 const evidence=await read(action.action);if(!evidence)return null;
 return saveCallEvidence(db,caseId,actionId,owner,evidence);
}
export async function saveCallEvidence(db:NodePgDatabase,caseId:string,actionId:string,owner:string,evidence:CallEvidence){
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,owner))).for("update");if(!item)throw Error("NOT_FOUND");
  const [action]=await tx.select().from(outreachActions).where(and(eq(outreachActions.id,actionId),eq(outreachActions.case_id,caseId)));
  if(!action||action.kind!=="call"||action.state!=="submitted"||action.provider_id!==evidence.provider_id)throw Error("CALL_RECEIPT_MISMATCH");
  const [saved]=await tx.insert(callEvidence).values({case_id:caseId,action_id:actionId,...evidence}).onConflictDoNothing().returning();
  await tx.update(outreachActions).set({provider_status:"completed",checked_at:new Date()}).where(eq(outreachActions.id,actionId));
  if(!saved){const [prior]=await tx.select().from(callEvidence).where(and(eq(callEvidence.action_id,actionId),eq(callEvidence.sha256,evidence.sha256)));return prior;}
  await tx.update(cases).set({revision:sql`${cases.revision}+1`,analysis:null,status:"new"}).where(eq(cases.id,caseId));
  // Wake only existing live authority. Never restore stopped/revoked authority or reset limits.
  await tx.update(caseAuthorities).set({next_wake_at:new Date()}).where(and(eq(caseAuthorities.case_id,caseId),inArray(caseAuthorities.state,["active","waiting"])));
  return saved;
 });
}

export async function pollCallEvidence(db:NodePgDatabase,read=readCallEvidence){
 const owners=(process.env.CREW_ALLOWED_USER_IDS??"").split(",").filter(Boolean);if(!owners.length)return {checked:0,imported:0,failed:0};
 const rows=await db.select({action:outreachActions,owner:cases.owner_id}).from(outreachActions).innerJoin(cases,eq(cases.id,outreachActions.case_id)).where(and(
  inArray(cases.owner_id,owners),eq(outreachActions.kind,"call"),eq(outreachActions.state,"submitted"),
  sql`${outreachActions.provider_id} IS NOT NULL`,sql`${outreachActions.created_at}>now()-interval '48 hours'`,
  sql`(${outreachActions.checked_at} IS NULL OR ${outreachActions.checked_at}<now()-interval '5 minutes')`,
  sql`NOT EXISTS (SELECT 1 FROM advocacy_call_evidence WHERE action_id=${outreachActions.id})`,
 )).limit(5);
 let imported=0,failed=0;
 for(const {action,owner} of rows){
  try{if(await importCallEvidence(db,action.case_id,action.id,owner,read))imported++;}catch{failed++;}
  await db.update(outreachActions).set({checked_at:new Date()}).where(eq(outreachActions.id,action.id));
 }
 return {checked:rows.length,imported,failed};
}
