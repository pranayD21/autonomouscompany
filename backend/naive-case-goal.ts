import {directBlocksNaive} from './migrate-direct-case';
import {createHash} from 'node:crypto';
import {and,eq,sql,inArray} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {z} from 'zod';
import {caseAgentEvents,caseAgentSessions,caseAuthorities,caseToolCredentials,cases} from './schema';
import {isOpenCasePermission} from './open-case-policy';
import type {CaseToolIdentity} from './case-tools';
const goalValue=z.object({goal:z.string().trim().min(1).max(4000),finish_condition:z.string().trim().min(1).max(4000)});
export const naiveGoalInput=goalValue.extend({refinement_reason:z.string().trim().min(1).max(4000).optional(),base_revision:z.number().int().nonnegative().optional()}).strict();
const goalKey='stable_goal';
function projectGoal(events:{kind:string;payload:Record<string,unknown>;created_at:Date}[]){
 const initial=events.find(e=>e.kind==='stable_goal');if(!initial)return null;
 const original=goalValue.parse(initial.payload);
 const history=events.filter(e=>e.kind==='goal_refinement').map(e=>({...goalValue.parse(e.payload),reason:z.string().parse(e.payload.reason),revision:z.number().parse(e.payload.revision),created_at:e.created_at})).sort((a,b)=>a.revision-b.revision);
 const current=history.at(-1)??original;
 return {goal:current.goal,finish_condition:current.finish_condition,initial_goal:original.goal,initial_finish_condition:original.finish_condition,revision:history.at(-1)?.revision??0,history};
}
export async function readNaiveCaseGoals(db:NodePgDatabase,caseId:string){
 const runs=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.case_id,caseId));
 const projected=[];
 for(const run of runs){const events=await db.select().from(caseAgentEvents).where(and(eq(caseAgentEvents.run_id,run.id),inArray(caseAgentEvents.kind,['stable_goal','goal_refinement'])));const goal=projectGoal(events);if(goal)projected.push({run_id:run.id,authority_id:run.authority_id,...goal});}
 return projected;
}
export async function setNaiveCaseGoal(db:NodePgDatabase,identity:CaseToolIdentity,raw:unknown){
 const input=naiveGoalInput.parse(raw);
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id))).for('update');
  const [credential]=await tx.select().from(caseToolCredentials).where(and(eq(caseToolCredentials.id,identity.id),eq(caseToolCredentials.case_id,identity.case_id),eq(caseToolCredentials.issued_by,identity.owner_id))).for('update');
  if(!item||!credential?.authority_id||credential.revoked_at||(credential.expires_at&&credential.expires_at<=new Date()))throw Error('INVALID_GOAL_BINDING');
  const [authority]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,credential.authority_id),eq(caseAuthorities.case_id,item.id),eq(caseAuthorities.approved_by,identity.owner_id))).for('update');
  const [run]=await tx.select().from(caseAgentSessions).where(and(eq(caseAgentSessions.authority_id,credential.authority_id),eq(caseAgentSessions.credential_id,credential.id),eq(caseAgentSessions.case_id,item.id))).for('update');
  if(!authority||!isOpenCasePermission(authority.policy)||!['active','waiting'].includes(authority.state)||!run||!['starting','running','idle'].includes(run.state))throw Error('INVALID_GOAL_BINDING');
  if((await tx.execute(sql`SELECT r.id FROM advocacy_direct_case_runs r WHERE r.authority_id=${authority.id} AND ${directBlocksNaive}`)).rows.length)throw Error('DIRECT_ENGINE_ALREADY_REGISTERED');
  const events=await tx.select().from(caseAgentEvents).where(and(eq(caseAgentEvents.run_id,run.id),inArray(caseAgentEvents.kind,['stable_goal','goal_refinement'])));
  const prior=projectGoal(events);
  if(prior){
   if(prior.goal===input.goal&&prior.finish_condition===input.finish_condition)return prior;
   if(!input.refinement_reason)throw Error('GOAL_REFINEMENT_REASON_REQUIRED');
   if(input.base_revision!==undefined&&input.base_revision!==prior.revision)throw Error('GOAL_REVISION_CONFLICT');
   const revision=prior.revision+1,payload={...goalValue.parse(input),reason:input.refinement_reason,revision};
   const event={run_id:run.id,event_key:`goal_refinement:${revision}:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`,kind:'goal_refinement',payload,delivered_at:new Date()};
   const [saved]=await tx.insert(caseAgentEvents).values(event).returning();
   return projectGoal([...events,saved])!;
  }
  const [saved]=await tx.insert(caseAgentEvents).values({run_id:run.id,event_key:goalKey,kind:'stable_goal',payload:goalValue.parse(input),delivered_at:new Date()}).returning();
  return projectGoal([saved])!;
 });
}
export async function requireNaiveCaseGoal(db:NodePgDatabase,identity:CaseToolIdentity){
 const [run]=await db.select({id:caseAgentSessions.id,policy:caseAuthorities.policy}).from(caseAgentSessions).innerJoin(caseAuthorities,eq(caseAuthorities.id,caseAgentSessions.authority_id)).where(and(eq(caseAgentSessions.case_id,identity.case_id),eq(caseAgentSessions.credential_id,identity.id),eq(caseAuthorities.approved_by,identity.owner_id)));
 if(!run||!isOpenCasePermission(run.policy))return;
 const [goal]=await db.select({id:caseAgentEvents.id}).from(caseAgentEvents).where(and(eq(caseAgentEvents.run_id,run.id),eq(caseAgentEvents.event_key,goalKey)));
 if(!goal)throw Error('NAIVE_GOAL_REQUIRED');
}
