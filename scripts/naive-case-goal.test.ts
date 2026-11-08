import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {setNaiveCaseGoal,readNaiveCaseGoals,requireNaiveCaseGoal} from '../backend/naive-case-goal';
import {issueCaseToolCredential} from '../backend/case-tool-auth';
import {caseToolServices} from '../backend/case-tool-service';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable database required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full')}),db=drizzle(pool),ids:string[]=[];
before(async()=>{await migrate(db,{migrationsFolder:'drizzle'});});
after(async()=>{for(const id of ids){await pool.query('DELETE FROM advocacy_case_agent_events WHERE run_id IN(SELECT id FROM advocacy_case_agent_sessions WHERE case_id=$1)',[id]);await pool.query('DELETE FROM advocacy_case_agent_sessions WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_case_tool_credentials WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_case_authorities WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[id]);}await pool.end();});
async function fixture(){
 const id=randomUUID(),owner=randomUUID();ids.push(id);
 await pool.query("INSERT INTO advocacy_cases(id,owner_id,title) VALUES($1,$2,'Fictional goal test')",[id,owner]);
 const {rows:[a]}=await pool.query("INSERT INTO advocacy_case_authorities(case_id,approved_by,policy) VALUES($1,$2,$3::jsonb) RETURNING id",[id,owner,JSON.stringify({version:2,consent:'Handle the fictional claim.'})]);
 const credential=await issueCaseToolCredential(db,id,owner,a.id);
 const {rows:[run]}=await pool.query("INSERT INTO advocacy_case_agent_sessions(case_id,authority_id,credential_id,identity_id,agent_id,agent_version) VALUES($1,$2,$3,'idn_fixture','agt_fixture',1) RETURNING id",[id,a.id,credential.id]);
 return {identity:{id:credential.id,case_id:id,owner_id:owner},authority:a.id,run:run.id};
}
const goal={goal:'Resolve the documented fictional claim dispute.',finish_condition:'Record the supported insurer decision and outstanding responsibilities.'};
test('goal is stable, idempotent, projected and not queued as incoming work',async()=>{
 const f=await fixture();await assert.rejects(()=>requireNaiveCaseGoal(db,f.identity),/NAIVE_GOAL_REQUIRED/);
 const [a,b]=await Promise.all([setNaiveCaseGoal(db,f.identity,goal),setNaiveCaseGoal(db,f.identity,goal)]);assert.deepEqual(a,b);
 await requireNaiveCaseGoal(db,f.identity);
 await assert.rejects(()=>setNaiveCaseGoal(db,f.identity,{...goal,goal:'A different goal'}),/GOAL_REFINEMENT_REASON_REQUIRED/);
 assert.deepEqual(await readNaiveCaseGoals(db,f.identity.case_id),[{run_id:f.run,authority_id:f.authority,...goal,initial_goal:goal.goal,initial_finish_condition:goal.finish_condition,revision:0,history:[]}]);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM advocacy_case_agent_events WHERE run_id=$1 AND delivered_at IS NULL',[f.run])).rows[0].n,0);
 const context=await caseToolServices(db).getCase(f.identity) as any;assert.equal(context.agent_goals[0].goal,goal.goal);
});
test('goal cannot cross owners/cases or use revoked credentials',async()=>{
 const f=await fixture(),other=await fixture();
 await assert.rejects(()=>setNaiveCaseGoal(db,{...f.identity,owner_id:other.identity.owner_id},goal),/INVALID_GOAL_BINDING/);
 await assert.rejects(()=>setNaiveCaseGoal(db,{...f.identity,case_id:other.identity.case_id},goal),/INVALID_GOAL_BINDING/);
 await pool.query('UPDATE advocacy_case_tool_credentials SET revoked_at=now() WHERE id=$1',[f.identity.id]);
 await assert.rejects(()=>setNaiveCaseGoal(db,f.identity,goal),/INVALID_GOAL_BINDING/);
});
test('v2 actions reject before goal without dispatching; stopped authority cannot set goal',async()=>{
 const f=await fixture();
 await assert.rejects(()=>caseToolServices(db).takeAction!(f.identity,{operation_id:randomUUID(),authority_id:f.authority,decision:{tool:'wait_for_reply',minutes:5,reason:'Waiting for evidence.',evidence_refs:['case:1']}}),/NAIVE_GOAL_REQUIRED/);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM advocacy_outreach_actions WHERE case_id=$1',[f.identity.case_id])).rows[0].n,0);
 await pool.query("UPDATE advocacy_case_authorities SET state='revoked' WHERE id=$1",[f.authority]);
 await assert.rejects(()=>setNaiveCaseGoal(db,f.identity,goal),/INVALID_GOAL_BINDING/);
});

test('refinement records reason and immutable original objective; retries are safe and stale updates rejected',async()=>{
 const f=await fixture();await setNaiveCaseGoal(db,f.identity,goal);
 const refined={...goal,finish_condition:'Record the supported insurer decision, appeal rights and remaining responsibilities.',refinement_reason:'The insurer letter identifies appeal rights that should be included in the final explanation.',base_revision:0};
 const result=await setNaiveCaseGoal(db,f.identity,refined),retry=await setNaiveCaseGoal(db,f.identity,refined);assert.deepEqual(result,retry);
 assert.equal(result.initial_goal,goal.goal);assert.equal(result.initial_finish_condition,goal.finish_condition);assert.equal(result.revision,1);assert.equal(result.history[0].reason,refined.refinement_reason);
 await assert.rejects(setNaiveCaseGoal(db,f.identity,{...refined,finish_condition:'Document the final decision and responsibilities with supporting evidence.'}),/GOAL_REVISION_CONFLICT/);
 const original=(await pool.query("SELECT payload FROM advocacy_case_agent_events WHERE run_id=$1 AND event_key='stable_goal'",[f.run])).rows[0].payload;assert.deepEqual(original,goal);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM advocacy_case_agent_events WHERE run_id=$1 AND delivered_at IS NULL',[f.run])).rows[0].n,0);
 const context=await caseToolServices(db).getCase(f.identity) as any;assert.equal(context.agent_goals[0].history.length,1);
});
