import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {executeFirmTool} from '../backend/firm-service';
import {requestFirmStaffing,reserveFirmHire} from '../backend/firm-events';
import {requestCompanyHelp} from '../backend/case-company';
import {DEFAULT_CASE_BUDGET_MICRO_USD} from '../backend/firm-blueprint';
import {issueCaseToolCredential} from '../backend/case-tool-auth';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable database required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full')}),db=drizzle(pool),ids:string[]=[],ops:string[]=[];
before(async()=>{await migrate(db,{migrationsFolder:'drizzle'});process.env.ASSURANCE_FIRM_ENABLED='true';});
after(async()=>{for(const id of ids){await pool.query('DELETE FROM advocacy_case_tool_credentials WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_case_authorities WHERE case_id=$1',[id]);await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[id]);}for(const id of ops){await pool.query('DELETE FROM advocacy_firm_operations WHERE id=$1',[id]);await pool.query('DELETE FROM advocacy_firm_records WHERE key LIKE $1',[`%${id}%`]);}await pool.end();});
async function fixture(){const id=randomUUID(),owner=randomUUID();ids.push(id);await pool.query("INSERT INTO advocacy_cases(id,owner_id,title) VALUES($1,$2,'Fictional firm test')",[id,owner]);const {rows:[a]}=await pool.query("INSERT INTO advocacy_case_authorities(case_id,approved_by,policy) VALUES($1,$2,$3::jsonb) RETURNING id",[id,owner,JSON.stringify({version:2,consent:'Handle this fictional case.'})]);const c=await issueCaseToolCredential(db,id,owner,a.id);return {id,owner,authority:a.id,identity:{id:c.id,case_id:id,owner_id:owner}};}
function operation(){const id=randomUUID();ops.push(id);return id;}
test('roles cannot invoke other roles or forge authentication proof records',async()=>{
 await assert.rejects(()=>executeFirmTool(db,'growth','set_case_budget',{}),/ROLE_TOOL_DENIED/);
 await assert.rejects(()=>executeFirmTool(db,'finance','email_verification',{}),/ROLE_TOOL_DENIED/);
});
test('staffing retries reuse one request and refuse silent authority transfer',async()=>{
 const f=await fixture();await requestFirmStaffing(db,f.id,f.authority);await requestFirmStaffing(db,f.id,f.authority);
 assert.equal((await pool.query('SELECT count(*)::int n FROM advocacy_firm_events WHERE case_id=$1',[f.id])).rows[0].n,2);
 await assert.rejects(()=>requestFirmStaffing(db,f.id,randomUUID()),/EXPLICIT_HANDOVER/);
});
test('case requests are scoped, idempotent and blocked by revocation',async()=>{
 const f=await fixture(),other=await fixture(),input={operation_id:operation(),role:'reviewer' as const,request:'Check the documented outcome evidence.'};
 const first=await requestCompanyHelp(db,f.identity,input);assert.deepEqual(await requestCompanyHelp(db,f.identity,input),first);
 await assert.rejects(()=>requestCompanyHelp(db,other.identity,input),/OPERATION_CONFLICT/);
 await pool.query('UPDATE advocacy_case_tool_credentials SET revoked_at=now() WHERE id=$1',[f.identity.id]);
 await assert.rejects(()=>requestCompanyHelp(db,f.identity,{...input,operation_id:operation()}),/INVALID_CASE_BINDING/);
});
test('playbooks preserve revisions and exact operation retries',async()=>{
 const insurer=`Fictional carrier ${randomUUID()}`,id=operation(),input={operation_id:id,insurer,content:'Ask for the documented decision reason.',sources:['https://example.com/procedure']};
 const first=await executeFirmTool(db,'knowledge','write_playbook',input);assert.deepEqual(await executeFirmTool(db,'knowledge','write_playbook',input),first);
 await assert.rejects(()=>executeFirmTool(db,'knowledge','write_playbook',{...input,content:'Different'}),/OPERATION_CONFLICT/);
 const second=operation();await executeFirmTool(db,'knowledge','write_playbook',{...input,operation_id:second,content:'Read the decision and its stated deadline.'});
 assert.equal((await pool.query("SELECT count(*)::int n FROM advocacy_firm_records WHERE kind='playbook_revision' AND payload->>'insurer'=$1",[insurer])).rows[0].n,2);
 await pool.query('DELETE FROM advocacy_firm_records WHERE key=$1',[`playbook:${insurer.toLowerCase()}`]);
});
test('test fees require a supported recorded outcome, not arbitrary savings',async()=>{
 const f=await fixture();await assert.rejects(()=>executeFirmTool(db,'finance','record_test_fee',{operation_id:operation(),case_id:f.id,savings_cents:100000,fee_rate:0.01,reason:'Unsubstantiated amount.'}));
});

test('different operation IDs cannot reserve two advocates and revocation blocks hiring',async()=>{
 const f=await fixture();await requestFirmStaffing(db,f.id,f.authority);await pool.query("UPDATE advocacy_firm_staffing SET state='budgeted',budget_micro_usd=1000 WHERE case_id=$1",[f.id]);
 const results=await Promise.all([reserveFirmHire(db,f.id,f.authority),reserveFirmHire(db,f.id,f.authority)]);assert.equal(results.filter(Boolean).length,1);
 const other=await fixture();await requestFirmStaffing(db,other.id,other.authority);await pool.query("UPDATE advocacy_case_authorities SET state='revoked' WHERE id=$1",[other.authority]);await assert.rejects(()=>reserveFirmHire(db,other.id,other.authority),/AUTHORITY_NOT_ACTIVE/);
});

test('revoked intake cannot request a budget or hire through company tools',async()=>{const f=await fixture();await requestFirmStaffing(db,f.id,f.authority);await pool.query("UPDATE advocacy_case_authorities SET state='revoked' WHERE id=$1",[f.authority]);await assert.rejects(executeFirmTool(db,'frontdesk','hire_advocate',{operation_id:operation(),case_id:f.id}),/AUTHORITY_NOT_ACTIVE/);await assert.rejects(executeFirmTool(db,'ceo','set_case_budget',{operation_id:operation(),case_id:f.id,budget_micro_usd:1000,reason:'Review the case.'}),/AUTHORITY_NOT_ACTIVE/);});
function providerStub(routes:(method:string,path:string,body:any)=>unknown){const original=globalThis.fetch,calls:string[]=[];globalThis.fetch=(async(input:any,init:any)=>{const url=new URL(String(input)),method=init?.method??'GET',body=init?.body?JSON.parse(init.body):undefined;calls.push(`${method} ${url.pathname}`);return Response.json(routes(method,url.pathname,body));}) as typeof fetch;return {calls,restore(){globalThis.fetch=original;}};}
test('a token CEO allocation is raised to the default ceiling, within existing credit',async()=>{const f=await fixture();await requestFirmStaffing(db,f.id,f.authority);const stub=providerStub(()=>({balance_micro_usd:250000000}));try{const result:any=await executeFirmTool(db,'ceo','set_case_budget',{operation_id:operation(),case_id:f.id,budget_micro_usd:50000,reason:'Fictional allocation'});assert.equal(result.budget_micro_usd,DEFAULT_CASE_BUDGET_MICRO_USD);assert.equal(result.requested_micro_usd,50000);const {rows:[staff]}=await pool.query('SELECT budget_micro_usd FROM advocacy_firm_staffing WHERE case_id=$1',[f.id]);assert.equal(staff.budget_micro_usd,DEFAULT_CASE_BUDGET_MICRO_USD);const {rows:events}=await pool.query("SELECT 1 FROM advocacy_firm_events WHERE case_id=$1 AND kind='budget_allocated'",[f.id]);assert.equal(events.length,1);}finally{stub.restore();}});
test('the default ceiling never exceeds existing credit and a larger request is still refused',async()=>{const f=await fixture();await requestFirmStaffing(db,f.id,f.authority);const stub=providerStub(()=>({balance_micro_usd:20000000}));try{const result:any=await executeFirmTool(db,'ceo','set_case_budget',{operation_id:operation(),case_id:f.id,budget_micro_usd:50000,reason:'Fictional allocation'});assert.equal(result.budget_micro_usd,20000000);await assert.rejects(()=>executeFirmTool(db,'ceo','set_case_budget',{operation_id:operation(),case_id:f.id,budget_micro_usd:20000001,reason:'Fictional allocation'}),/INSUFFICIENT_EXISTING_CREDIT/);}finally{stub.restore();}});
