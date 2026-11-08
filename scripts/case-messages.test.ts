import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {readCaseMessages,sendCaseMessage,postAgentCaseMessage,requestCaseDocument} from '../backend/case-messages';
import {submitCase} from '../backend/intake-service';
import {revokeCaseAuthority} from '../backend/autonomy-service';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable database required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full')}),db=drizzle(pool),owner=randomUUID(),ids:string[]=[];
const input={title:'Website chat fixture',case_type:'workplace_injury',intake:{injury_description:'Fictional chemical burn, no external contacts.'}};
async function fixture(start=false){const id=randomUUID();ids.push(id);await submitCase(db,owner,input,start,id);return id;}
before(async()=>{await migrate(db,{migrationsFolder:'drizzle'});process.env.ASSURANCE_CASE_ENGINE='direct_openai';process.env.ASSURANCE_DIRECT_ACTIVATION_ENABLED='true';});
after(async()=>{for(const id of ids){await pool.query('DELETE FROM advocacy_outreach_actions WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_case_decisions WHERE authority_id IN(SELECT id FROM advocacy_case_authorities WHERE case_id=$1)',[id]);await pool.query('DELETE FROM advocacy_case_agent_setups WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_case_authorities WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[id]);}await pool.end();});
test('saved case keeps messages before any engine exists, deduplicates concurrent retries and isolates owners',async()=>{
 const id=await fixture(),message={id:randomUUID(),text:'I can upload the incident report.'};
 await Promise.all([sendCaseMessage(db,id,owner,message),sendCaseMessage(db,id,owner,message)]);
 const history=await readCaseMessages(db,id,owner);assert.equal(history.state,'saved');assert.equal(history.messages.length,1);assert.equal(history.messages[0].text,message.text);
 assert.equal((await pool.query('SELECT revision FROM advocacy_cases WHERE id=$1',[id])).rows[0].revision,2);
 await assert.rejects(()=>sendCaseMessage(db,id,owner,{...message,text:'Different'}),/UPDATE_CONFLICT/);
 await assert.rejects(()=>readCaseMessages(db,id,randomUUID()),/NOT_FOUND/);await assert.rejects(()=>sendCaseMessage(db,id,randomUUID(),{id:randomUUID(),text:'Intrusion'}),/NOT_FOUND/);
});
test('owner answers resume same paused run; stopped case stores messages without restarting',async()=>{
 const id=await fixture(true),{rows:[run]}=await pool.query('SELECT * FROM advocacy_direct_case_runs WHERE case_id=$1',[id]);
 await pool.query("UPDATE advocacy_direct_case_runs SET state='human_required' WHERE id=$1",[run.id]);
 assert.equal((await sendCaseMessage(db,id,owner,{id:randomUUID(),text:'The incident happened Monday.'})).resumed,true);
 await revokeCaseAuthority(db,id,run.authority_id,owner);
 assert.equal((await sendCaseMessage(db,id,owner,{id:randomUUID(),text:'Keep this note for later.'})).resumed,false);
 assert.equal((await readCaseMessages(db,id,owner)).state,'stopped');assert.equal((await pool.query('SELECT state FROM advocacy_direct_case_runs WHERE id=$1',[run.id])).rows[0].state,'stopped');
});
test('unresolved dispatch preserves the answer and leaves the agent paused',async()=>{
 const id=await fixture(true);await pool.query("UPDATE advocacy_direct_case_runs SET state='human_required',pending='[{\"started\":true}]'::jsonb WHERE case_id=$1",[id]);
 assert.equal((await sendCaseMessage(db,id,owner,{id:randomUUID(),text:'Here is the missing date.'})).resumed,false);
 const h=await readCaseMessages(db,id,owner);assert.equal(h.messages.length,1);assert.equal(h.state,'human_required');
});
test('agent messages and document requests are durable, idempotent and require active bound permission',async()=>{
 const id=await fixture(true),{rows:[run]}=await pool.query('SELECT * FROM advocacy_direct_case_runs WHERE case_id=$1',[id]);const identity={id:run.credential_id,case_id:id,owner_id:owner};
 const update={operation_id:randomUUID(),text:'I am reviewing the uploaded information.',kind:'update' as const};await postAgentCaseMessage(db,identity,update);await postAgentCaseMessage(db,identity,update);
 await assert.rejects(()=>postAgentCaseMessage(db,identity,{...update,text:'Different'}),/OPERATION_CONFLICT/);
 const request={operation_id:randomUUID(),authority_id:run.authority_id,kind:'insurance_card' as const};const first=await requestCaseDocument(db,identity,request),second=await requestCaseDocument(db,identity,{...request,operation_id:randomUUID()});assert.equal(first.id,second.id);
 const h=await readCaseMessages(db,id,owner);assert.equal(h.messages.length,2);assert.equal(h.messages[0].role,'assistant');
 assert.equal((await pool.query('SELECT count(*)::int AS count FROM advocacy_phone_notifications WHERE case_id=$1',[id])).rows[0].count,0);
 await revokeCaseAuthority(db,id,run.authority_id,owner);await assert.rejects(()=>postAgentCaseMessage(db,identity,{operation_id:randomUUID(),text:'New update'}),/MESSAGE_NOT_AUTHORIZED/);
});
test('assistant questions come from actual case decisions and never leak across cases',async()=>{
 const id=await fixture(true),other=await fixture(),{rows:[a]}=await pool.query('SELECT id FROM advocacy_case_authorities WHERE case_id=$1',[id]);
 await pool.query("INSERT INTO advocacy_case_decisions(authority_id,round,case_revision,state,input,decision) VALUES($1,1,1,'finished','{}'::jsonb,$2::jsonb)",[a.id,JSON.stringify({tool:'request_human_help',question:'What was the incident date?',reason:'Date is missing.',evidence_refs:['case:1']})]);
 const h=await readCaseMessages(db,id,owner);assert.equal(h.messages.length,1);assert.equal(h.messages[0].text,'What was the incident date?');assert.equal((await readCaseMessages(db,other,owner)).messages.length,0);
});

test('agent-authored document type and message persist exactly and deduplicate by type',async()=>{
 const id=await fixture(true),{rows:[run]}=await pool.query('SELECT * FROM advocacy_direct_case_runs WHERE case_id=$1',[id]);const identity={id:run.credential_id,case_id:id,owner_id:owner};
 const request={operation_id:randomUUID(),authority_id:run.authority_id,document_type:'Employer incident acknowledgement',message:'Could you upload the acknowledgement your employer sent after you reported the incident?'};
 const first=await requestCaseDocument(db,identity,request),retry=await requestCaseDocument(db,identity,request),duplicate=await requestCaseDocument(db,identity,{...request,operation_id:randomUUID()});assert.equal(first.id,retry.id);assert.equal(first.id,duplicate.id);
 const messages=(await readCaseMessages(db,id,owner)).messages;assert.equal(messages.length,1);assert.equal(messages[0].text,request.message);assert.equal(messages[0].kind,`document_request:${request.document_type}`);
 await assert.rejects(requestCaseDocument(db,identity,{...request,document_type:'A different record'}),/OPERATION_CONFLICT/);
 await assert.rejects(requestCaseDocument(db,identity,{...request,message:'A changed request'}),/OPERATION_CONFLICT/);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM advocacy_outreach_actions WHERE case_id=$1',[id])).rows[0].n,0);
});
