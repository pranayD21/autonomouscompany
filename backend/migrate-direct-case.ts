import {and,eq,sql} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {cases,caseAuthorities,directCaseRuns,caseToolCredentials,caseAgentSetups,firmRecords} from './schema';
import {isOpenCasePermission} from './open-case-policy';
import {firmEnabled,requestFirmStaffing} from './firm-events';
// This predicate permits only an explicit migration with its matching durable audit record.
export const directBlocksNaive=sql.raw(`NOT (r.state='migrated' AND EXISTS (SELECT 1 FROM advocacy_firm_records m WHERE m.key='direct-migration:'||r.authority_id::text AND m.kind='direct_engine_migration' AND m.case_id=r.case_id AND m.payload->>'direct_run_id'=r.id::text AND m.actor=r.owner_id))`);
export async function migrateDirectCaseToNaive(db:NodePgDatabase,input:{case_id:string;authority_id:string;owner_id:string;confirm:true}){
 if(input.confirm!==true)throw Error('EXPLICIT_MIGRATION_REQUIRED');
 return db.transaction(async tx=>{
  const [authority]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,input.authority_id),eq(caseAuthorities.case_id,input.case_id),eq(caseAuthorities.approved_by,input.owner_id))).for('update');
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,input.case_id),eq(cases.owner_id,input.owner_id))).for('update');
  const [run]=await tx.select().from(directCaseRuns).where(and(eq(directCaseRuns.authority_id,input.authority_id),eq(directCaseRuns.case_id,input.case_id),eq(directCaseRuns.owner_id,input.owner_id))).for('update');
  if(!item||!authority||!run)throw Error('NOT_FOUND');
  const key=`direct-migration:${authority.id}`;
  const [prior]=await tx.select().from(firmRecords).where(eq(firmRecords.key,key));
  if(run.state==='migrated'&&prior?.kind==='direct_engine_migration'&&prior.payload.direct_run_id===run.id&&prior.actor===input.owner_id)return {state:'migrated',authority_id:authority.id};
  if(!isOpenCasePermission(authority.policy)||!['active','waiting'].includes(authority.state))throw Error('AUTHORITY_NOT_ACTIVE');
  if(!['idle','queued'].includes(run.state)||run.lease_id||run.lease_until||authority.lease_id||authority.lease_until||!Array.isArray(run.pending)||run.pending.length)throw Error('DIRECT_RUN_BUSY');
  const unsafe=await tx.execute(sql`SELECT id FROM advocacy_outreach_actions WHERE case_id=${item.id} AND state IN ('dispatching','unknown') UNION ALL SELECT id FROM advocacy_case_decisions WHERE authority_id=${authority.id} AND state<>'finished' UNION ALL SELECT id FROM advocacy_case_agent_sessions WHERE authority_id=${authority.id} LIMIT 1`);
  if(unsafe.rows.length)throw Error('UNRESOLVED_WORK');
  if(!firmEnabled()&&process.env.NAIVE_CASE_PROVISIONING_ENABLED!=='true')throw Error('NAIVE_ACTIVATION_UNAVAILABLE');
  await tx.insert(firmRecords).values({key,kind:'direct_engine_migration',case_id:item.id,actor:input.owner_id,payload:{direct_run_id:run.id,authority_id:authority.id,from:'direct_openai',to:'naive',goal:run.goal,finish_condition:run.finish_condition,observed_revision:run.observed_revision,trust:'prior_agent_context_not_verified_evidence'}});
  await tx.update(directCaseRuns).set({state:'migrated',next_check_at:null,reason:'Explicit migration to Naïve under the unchanged owner authority.',updated_at:new Date()}).where(eq(directCaseRuns.id,run.id));
  await tx.update(caseToolCredentials).set({revoked_at:new Date()}).where(eq(caseToolCredentials.id,run.credential_id));
  await tx.insert(caseAgentSetups).values({case_id:item.id,authority_id:authority.id,requested_by:input.owner_id}).onConflictDoNothing();
  if(firmEnabled())await requestFirmStaffing(tx,item.id,authority.id);
  return {state:'migrated',authority_id:authority.id};
 });
}
