import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {submitCase,addOwnerUpdate} from '../backend/intake-service';
import {revokeCaseAuthority} from '../backend/autonomy-service';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable database required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full')}),db=drizzle(pool),owner=randomUUID(),ids:string[]=[];
const input={title:'Intake service fixture',case_type:'workplace_injury',intake:{injury_description:'Fictional workplace burn; no external contacts.'}};
before(async()=>{await migrate(db,{migrationsFolder:'drizzle'});process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED='true';});
after(async()=>{for(const id of ids){await pool.query('DELETE FROM advocacy_case_authorities WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[id]);}await pool.end();});
function id(){const value=randomUUID();ids.push(value);return value;}
test('submission is atomic, idempotent, owned and does not revive stopped work',async()=>{
 const caseId=id();const results=await Promise.all([submitCase(db,owner,input,true,caseId),submitCase(db,owner,input,true,caseId)]);assert.ok(results.every(r=>r.agent_started));
 const {rows}=await pool.query('SELECT * FROM advocacy_case_authorities WHERE case_id=$1',[caseId]);assert.equal(rows.length,1);
 assert.equal((await pool.query('SELECT * FROM advocacy_direct_case_runs WHERE case_id=$1',[caseId])).rows.length,1);
 await assert.rejects(()=>submitCase(db,randomUUID(),input,true,caseId),/NOT_FOUND/);
 await revokeCaseAuthority(db,caseId,rows[0].id,owner);await submitCase(db,owner,input,true,caseId);
 assert.equal((await pool.query('SELECT state FROM advocacy_direct_case_runs WHERE case_id=$1',[caseId])).rows[0].state,'stopped');
 const failed=id();process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED='false';await assert.rejects(()=>submitCase(db,owner,input,true,failed),/UNAVAILABLE/);process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED='true';assert.equal((await pool.query('SELECT id FROM advocacy_cases WHERE id=$1',[failed])).rowCount,0);
});
test('answer persists once and resumes same grant; uncertainty preserves answer without resuming',async()=>{
 const caseId=id();await submitCase(db,owner,input,true,caseId);const {rows:[run]}=await pool.query('SELECT * FROM advocacy_direct_case_runs WHERE case_id=$1',[caseId]);
 await pool.query("UPDATE advocacy_direct_case_runs SET state='human_required',goal='Keep goal' WHERE id=$1",[run.id]);
 const event=randomUUID();assert.equal((await addOwnerUpdate(db,caseId,owner,'Incident was Monday.',event)).resumed,true);
 await addOwnerUpdate(db,caseId,owner,'Incident was Monday.',event);
 assert.equal((await pool.query('SELECT revision FROM advocacy_cases WHERE id=$1',[caseId])).rows[0].revision,2);
 await assert.rejects(()=>addOwnerUpdate(db,caseId,owner,'Different answer',event),/UPDATE_CONFLICT/);
 await pool.query(`UPDATE advocacy_direct_case_runs SET state='human_required',pending='[{"started":true}]'::jsonb WHERE id=$1`,[run.id]);
 assert.equal((await addOwnerUpdate(db,caseId,owner,'More context.',randomUUID())).resumed,false);
 const {rows:[after]}=await pool.query('SELECT * FROM advocacy_direct_case_runs WHERE id=$1',[run.id]);assert.equal(after.state,'human_required');assert.equal(after.goal,'Keep goal');assert.equal(after.pending[0].started,true);
 await assert.rejects(()=>addOwnerUpdate(db,caseId,randomUUID(),'Other owner',randomUUID()),/NOT_FOUND/);
});
