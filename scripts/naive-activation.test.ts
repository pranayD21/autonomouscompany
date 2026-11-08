import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {authorizeCase,readCaseAutonomy,resumeCaseAuthority,revokeCaseAuthority} from '../backend/autonomy-service';
import {submitCase,addOwnerUpdate} from '../backend/intake-service';
import {issueCaseToolCredential,resolveCaseToolCredential} from '../backend/case-tool-auth';
import {registerCaseAgentSession,advanceCaseAgentSession,type CaseSessionDependencies} from '../backend/case-agent-session';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable database required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full')}),db=drizzle(pool),owner=randomUUID(),ids:string[]=[];
const permission={version:2,consent:'  Handle this fictional case without external contact in this test.  '};
const input={title:'Naïve activation fixture',case_type:'workplace_injury',intake:{injury_description:'Fictional incident for service integration testing.'}};
before(async()=>{await migrate(db,{migrationsFolder:'drizzle'});Object.assign(process.env,{ASSURANCE_CASE_ENGINE:'naive',NAIVE_CASE_PROVISIONING_ENABLED:'true',ASSURANCE_DIRECT_ACTIVATION_ENABLED:'true',CREW_ALLOWED_USER_IDS:''});});
after(async()=>{for(const id of ids){await pool.query('DELETE FROM advocacy_case_agent_events WHERE run_id IN(SELECT id FROM advocacy_case_agent_sessions WHERE case_id=$1)',[id]);await pool.query('DELETE FROM advocacy_case_agent_sessions WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_outreach_actions WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_case_authorities WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[id]);}await pool.end();});
async function emptyCase(){const id=randomUUID();ids.push(id);await submitCase(db,owner,input,false,id);return id;}
async function registered(){
 const id=await emptyCase(),authority=await authorizeCase(db,id,owner,permission,undefined,true);
 const credential=await issueCaseToolCredential(db,id,owner,authority.id);
 const run=await registerCaseAgentSession(db,{case_id:id,authority_id:authority.id,credential_id:credential.id,identity_id:`idn_${randomUUID()}`,agent_id:'agt_fixture',agent_version:1},owner);
 await pool.query("UPDATE advocacy_case_agent_sessions SET state='human_required',session_id=$2 WHERE id=$1",[run.id,`ses_${randomUUID()}`]);
 await pool.query("UPDATE advocacy_case_authorities SET state='human_required',decisions_used=7,outbound_used=2 WHERE id=$1",[authority.id]);
 return {id,authority,credential,run};
}
test('v2 Naïve activation queues setup without direct run, credential, review, or operator membership',async()=>{
 const id=await emptyCase(),authority=await authorizeCase(db,id,owner,permission,undefined,true);
 assert.deepEqual(authority.policy,{version:2,consent:permission.consent.trim()});
 const state=await readCaseAutonomy(db,id,owner);assert.equal(state.activation_available,true);assert.equal(state.setups.length,1);assert.equal(state.setups[0].authority_id,authority.id);assert.equal(state.sessions.length,0);
 assert.equal((await pool.query('SELECT id FROM advocacy_case_tool_credentials WHERE case_id=$1',[id])).rowCount,0);
 assert.equal((await pool.query('SELECT id FROM advocacy_direct_case_runs WHERE case_id=$1',[id])).rowCount,0);
 await assert.rejects(()=>authorizeCase(db,id,owner,permission,undefined,true),/AUTHORITY_ALREADY_EXISTS/);
});
test('disabled selected engine rolls back submitted case and does not fall through to direct',async()=>{
 const id=randomUUID();ids.push(id);process.env.NAIVE_CASE_PROVISIONING_ENABLED='false';
 try{await assert.rejects(()=>submitCase(db,owner,input,true,id),/UNAVAILABLE/);assert.equal((await pool.query('SELECT id FROM advocacy_cases WHERE id=$1',[id])).rowCount,0);}
 finally{process.env.NAIVE_CASE_PROVISIONING_ENABLED='true';}
});
test('changing default engine leaves existing direct run and its grant unchanged',async()=>{
 process.env.ASSURANCE_CASE_ENGINE='direct_openai';const id=randomUUID();ids.push(id);
 try{await submitCase(db,owner,input,true,id);}finally{process.env.ASSURANCE_CASE_ENGINE='naive';}
 const before=await readCaseAutonomy(db,id,owner);
 await submitCase(db,owner,input,true,id);
 const after=await readCaseAutonomy(db,id,owner);assert.equal(after.sessions.length,1);assert.equal(after.sessions[0].engine,'direct_openai');assert.equal(after.sessions[0].id,before.sessions[0].id);assert.equal(after.authorities[0].id,before.authorities[0].id);assert.equal(after.setups.length,0);
});
test('owner answer resumes same Naïve session and permission with deduplicated evidence',async()=>{
 const f=await registered(),key=randomUUID(),before=(await pool.query('SELECT session_id FROM advocacy_case_agent_sessions WHERE id=$1',[f.run.id])).rows[0];
 assert.deepEqual(await addOwnerUpdate(db,f.id,owner,'The fictional incident happened Tuesday.',key),{saved:true,resumed:true});
 assert.deepEqual(await addOwnerUpdate(db,f.id,owner,'The fictional incident happened Tuesday.',key),{saved:true,resumed:false});
 await assert.rejects(()=>addOwnerUpdate(db,f.id,owner,'A conflicting answer.',key),/UPDATE_CONFLICT/);
 const state=await readCaseAutonomy(db,f.id,owner);assert.equal(state.sessions[0].engine,'naive');assert.equal(state.sessions[0].state,'idle');assert.equal(state.authorities[0].id,f.authority.id);assert.equal(state.authorities[0].decisions_used,7);assert.equal(state.authorities[0].outbound_used,2);assert.deepEqual(state.authorities[0].policy,{version:2,consent:permission.consent.trim()});
 assert.equal((await pool.query('SELECT session_id FROM advocacy_case_agent_sessions WHERE id=$1',[f.run.id])).rows[0].session_id,before.session_id);
 assert.equal((await pool.query('SELECT revision FROM advocacy_cases WHERE id=$1',[f.id])).rows[0].revision,2);
 const events=(await pool.query('SELECT event_key,kind FROM advocacy_case_agent_events WHERE run_id=$1',[f.run.id])).rows;
 assert.equal(events.filter(e=>e.event_key===`owner_answer:${key}`).length,1);assert.equal(events.filter(e=>e.kind==='owner_resumed').length,1);
});
test('unresolved outbound dispatch preserves answer but prevents resume',async()=>{
 const f=await registered();await pool.query("INSERT INTO advocacy_outreach_actions(id,case_id,kind,destination,subject,body,state) VALUES($1,$2,'email','fixture@example.com','Fixture','Not dispatched by this test','unknown')",[randomUUID(),f.id]);
 await assert.rejects(()=>resumeCaseAuthority(db,f.id,f.authority.id,owner),/UNRESOLVED_DISPATCH/);
 assert.deepEqual(await addOwnerUpdate(db,f.id,owner,'Additional fictional facts.',randomUUID()),{saved:true,resumed:false});
 assert.equal((await readCaseAutonomy(db,f.id,owner)).sessions[0].state,'human_required');
});
test('owner isolation and revoke prevent reads, answers, resume, and future session work',async()=>{
 const f=await registered(),stranger=randomUUID();
 await assert.rejects(()=>readCaseAutonomy(db,f.id,stranger),/NOT_FOUND/);
 await assert.rejects(()=>addOwnerUpdate(db,f.id,stranger,'Intrusion',randomUUID()),/NOT_FOUND/);
 await assert.rejects(()=>resumeCaseAuthority(db,f.id,f.authority.id,stranger),/NOT_FOUND/);
 await assert.rejects(()=>revokeCaseAuthority(db,f.id,f.authority.id,stranger),/NOT_FOUND/);
 await revokeCaseAuthority(db,f.id,f.authority.id,owner);assert.equal(await resolveCaseToolCredential(db,f.credential.token),null);
 await assert.rejects(()=>resumeCaseAuthority(db,f.id,f.authority.id,owner),/NOT_RESUMABLE/);
 let cancels=0;const forbidden=async()=>{throw Error('Must not infer or send');};
 const deps:CaseSessionDependencies={verifyBinding:forbidden,start:forbidden,read:forbidden,send:forbidden,cancel:async()=>{cancels++;}};
 await advanceCaseAgentSession(db,f.run.id,deps);assert.equal(cancels,1);assert.equal((await readCaseAutonomy(db,f.id,owner)).sessions[0].state,'stopped');
});
test('cross-case credential cannot resume a Naïve session',async()=>{
 const f=await registered(),other=await emptyCase();await pool.query('UPDATE advocacy_case_tool_credentials SET case_id=$2 WHERE id=$1',[f.credential.id,other]);
 await assert.rejects(()=>resumeCaseAuthority(db,f.id,f.authority.id,owner),/PERMISSION_ENDED/);
});
