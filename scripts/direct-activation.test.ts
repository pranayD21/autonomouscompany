import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {advanceDirectCaseRun,type DirectRun} from '../backend/direct-case-runner';
import {issueCaseToolCredential,resolveCaseToolCredential} from '../backend/case-tool-auth';
import {authorizeCase,readCaseAutonomy,resumeCaseAuthority,revokeCaseAuthority} from '../backend/autonomy-service';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable database required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full')}),db=drizzle(pool),owner=randomUUID(),ids:string[]=[];
before(async()=>{await migrate(db,{migrationsFolder:'drizzle'});process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED='true';});
after(async()=>{for(const id of ids){await pool.query('DELETE FROM advocacy_case_authorities WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[id]);}await pool.end();});
async function fixture(){const id=randomUUID();ids.push(id);await pool.query("INSERT INTO advocacy_cases(id,owner_id,title,notes) VALUES($1,$2,'Activation fixture','Fictional claim')",[id,owner]);return id;}
const permission={version:2,consent:'  Research my fictional claim. Ask me before contact.  '};
test('v2 activation atomically queues a direct run without review or operator grant',async()=>{
 const id=await fixture();const authority=await authorizeCase(db,id,owner,permission,undefined,true);
 assert.deepEqual(authority.policy,{version:2,consent:permission.consent.trim()});
 const history=await readCaseAutonomy(db,id,owner);assert.equal(history.activation_available,true);assert.equal(history.sessions.length,1);assert.equal(history.sessions[0].engine,'direct_openai');assert.equal(history.sessions[0].state,'queued');assert.equal(history.setups.length,0);
 const credentials=(await pool.query('SELECT * FROM advocacy_case_tool_credentials WHERE authority_id=$1',[authority.id])).rows;assert.equal(credentials.length,1);assert.equal(credentials[0].expires_at,null);
 const issued=await issueCaseToolCredential(db,id,owner,authority.id);assert.equal((await resolveCaseToolCredential(db,issued.token))?.owner_id,owner);
 await assert.rejects(()=>authorizeCase(db,id,owner,permission,undefined,true),/ALREADY_EXISTS/);
 await assert.rejects(()=>readCaseAutonomy(db,id,randomUUID()),/NOT_FOUND/);
});
test('disabled activation and wrong owner create no permission',async()=>{
 const id=await fixture();process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED='false';await assert.rejects(()=>authorizeCase(db,id,owner,permission,undefined,true),/UNAVAILABLE/);process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED='true';await assert.rejects(()=>authorizeCase(db,id,randomUUID(),permission,undefined,true),/NOT_FOUND/);assert.equal((await readCaseAutonomy(db,id,owner)).authorities.length,0);
});
test('owner resume preserves permission and conversation; uncertain dispatch cannot resume',async()=>{
 const id=await fixture(),authority=await authorizeCase(db,id,owner,permission,undefined,true);
 await pool.query("UPDATE advocacy_case_authorities SET state='human_required',decisions_used=7 WHERE id=$1",[authority.id]);
 await pool.query("UPDATE advocacy_direct_case_runs SET state='human_required',goal='Stable goal',turns=1 WHERE authority_id=$1",[authority.id]);
 await pool.query(`UPDATE advocacy_direct_case_runs SET pending='[{"started":false,"call":{"id":"unstarted_call","name":"case_get","arguments":{}}}]'::jsonb WHERE authority_id=$1`,[authority.id]);
 await assert.rejects(()=>resumeCaseAuthority(db,id,authority.id,randomUUID()),/NOT_FOUND/);
 await resumeCaseAuthority(db,id,authority.id,owner);
 const resumed=(await pool.query('SELECT pending,messages FROM advocacy_direct_case_runs WHERE authority_id=$1',[authority.id])).rows[0];assert.deepEqual(resumed.pending,[]);assert.ok(resumed.messages.some((m:{tool_call_id?:string})=>m.tool_call_id==='unstarted_call'));
 let history=await readCaseAutonomy(db,id,owner);assert.equal(history.authorities[0].decisions_used,7);assert.deepEqual(history.authorities[0].policy,{version:2,consent:permission.consent.trim()});
 assert.equal((history.sessions[0] as {goal?:string}).goal,'Stable goal');
 await pool.query("UPDATE advocacy_direct_case_runs SET state='stopped',next_check_at=NULL WHERE owner_id=$1 AND authority_id<>$2",[owner,authority.id]);
 let sawResume=false;
 const leased=(await pool.query("UPDATE advocacy_direct_case_runs SET lease_id=gen_random_uuid(),lease_until=now()+interval '10 minutes' WHERE authority_id=$1 RETURNING *",[authority.id])).rows[0] as DirectRun;
 await advanceDirectCaseRun(db,leased,{now:Date.now,timeSliceMs:30000,connect:async()=>({tools:[],call:async()=>({}),close:async()=>{}}),model:async messages=>{sawResume=messages.some(m=>typeof m.content==='string'&&m.content.includes('owner_resumed')&&m.content.includes('Read case_get before acting'));return {role:'assistant',content:'Waiting for evidence.'};}});
 assert.equal(sawResume,true);
 await pool.query('UPDATE advocacy_direct_case_runs SET lease_id=NULL,lease_until=NULL WHERE authority_id=$1',[authority.id]);

 await pool.query(`UPDATE advocacy_direct_case_runs SET state='human_required',pending='[{"started":true}]'::jsonb WHERE authority_id=$1`,[authority.id]);
 await assert.rejects(()=>resumeCaseAuthority(db,id,authority.id,owner),/UNRESOLVED_DISPATCH/);
 await revokeCaseAuthority(db,id,authority.id,owner);history=await readCaseAutonomy(db,id,owner);assert.equal(history.sessions[0].state,'stopped');assert.equal(history.authorities[0].state,'revoked');
 assert.ok((await pool.query('SELECT revoked_at FROM advocacy_case_tool_credentials WHERE authority_id=$1',[authority.id])).rows[0].revoked_at);
 await assert.rejects(()=>resumeCaseAuthority(db,id,authority.id,owner),/NOT_RESUMABLE/);
});
