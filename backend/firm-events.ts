import {and,eq} from "drizzle-orm";
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {firmEvents,firmStaffing,caseAuthorities} from './schema';
export type FirmRole='ceo'|'frontdesk'|'reviewer'|'knowledge'|'growth'|'finance';
export const firmEnabled=()=>process.env.ASSURANCE_FIRM_ENABLED==='true';
export async function queueFirmEvent(db:NodePgDatabase,input:{role:FirmRole;event_key:string;kind:string;case_id?:string;payload?:Record<string,unknown>}){
 await db.insert(firmEvents).values({...input,payload:input.payload??{}}).onConflictDoNothing();
}
export async function requestFirmStaffing(db:NodePgDatabase,caseId:string,authorityId:string){
 const [existing]=await db.select().from(firmStaffing).where(eq(firmStaffing.case_id,caseId));
 if(existing&&existing.authority_id!==authorityId){
  // Advocates are bound to one authority. Once the owner stopped that authority, a new grant
  // gets a fresh advocate; the old one stays bound to its revoked grant and cannot act.
  const [previous]=await db.select({state:caseAuthorities.state}).from(caseAuthorities).where(eq(caseAuthorities.id,existing.authority_id));
  if(previous&&['active','waiting','human_required'].includes(previous.state))throw Error('EXISTING_ADVOCATE_REQUIRES_EXPLICIT_HANDOVER');
  await db.update(firmStaffing).set({authority_id:authorityId,state:'requested',agent_id:null,budget_micro_usd:null,expected_recovery_cents:null,budget_reason:null,updated_at:new Date()}).where(and(eq(firmStaffing.case_id,caseId),eq(firmStaffing.authority_id,existing.authority_id)));
 }else await db.insert(firmStaffing).values({case_id:caseId,authority_id:authorityId}).onConflictDoNothing();
 await queueFirmEvent(db,{role:'frontdesk',event_key:`staff:${authorityId}`,kind:'new_case',case_id:caseId,payload:{authority_id:authorityId}});
 // Allocation is a CEO decision; queue it directly so bookkeeping cannot strand intake.
 await queueFirmEvent(db,{role:'ceo',event_key:`budget-needed:${authorityId}`,kind:'budget_needed',case_id:caseId,payload:{authority_id:authorityId}});
}

export async function reserveFirmHire(db:NodePgDatabase,caseId:string,authorityId:string){
 return db.transaction(async tx=>{
  const [authority]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,authorityId),eq(caseAuthorities.case_id,caseId))).for('update');
  if(!authority||!['active','waiting'].includes(authority.state))throw Error('AUTHORITY_NOT_ACTIVE');
  const [claimed]=await tx.update(firmStaffing).set({state:'hiring',updated_at:new Date()}).where(and(eq(firmStaffing.case_id,caseId),eq(firmStaffing.authority_id,authorityId),eq(firmStaffing.state,'budgeted'))).returning();return !!claimed;
 });
}
