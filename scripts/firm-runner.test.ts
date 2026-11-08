import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {approveFirmPending,firmBusinessResult,advanceFirmEvent,discoverScheduledApprovals,pollFirmEvents,type FirmProvider} from '../backend/firm-runner';
import {firmRoles} from '../backend/firm-blueprint';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable DB required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full')}),db=drizzle(pool),events:string[]=[],sessions:string[]=[];
const registry=Object.fromEntries(firmRoles.map(role=>[role,{agent_id:`agt_fixture_${role}`,identity_id:`idn_fixture_${role}`,version:1}]));
before(async()=>{await migrate(db,{migrationsFolder:'drizzle'});process.env.ASSURANCE_FIRM_REGISTRY=JSON.stringify(registry);process.env.ASSURANCE_FIRM_ENABLED='true';process.env.ASSURANCE_FIRM_BUDGET_MICRO_USD='1000000';});
after(async()=>{for(const id of events){await pool.query('DELETE FROM advocacy_firm_events WHERE id=$1',[id]);await pool.query('DELETE FROM advocacy_firm_records WHERE key=$1',[`firm-session-request:${id}`]);}for(const id of sessions){await pool.query("DELETE FROM advocacy_firm_operations WHERE result->>'session_id'=$1",[id]);await pool.query('DELETE FROM advocacy_firm_records WHERE key=$1',[`firm-session-blocked:${id}`]);}await pool.query("DELETE FROM advocacy_firm_records WHERE key='firm-approval-discovery'");await pool.end();});
function fixture(){const id=`ses_${randomUUID()}`;sessions.push(id);const action={kind:'tool',name:'firm.firm_status',args:{},tool_call_id:'call_1',parked_seq:1};const remote={id,agent_id:registry.ceo.agent_id,identity_id:registry.ceo.identity_id,status:'idle',stop_reason:'awaiting_approval',pending_actions:[action]};return {id,remote,action};}
test('firm confirmation is role scoped, audited once, and uncertain requests never replay',async()=>{
 const f=fixture();let confirmations=0;const provider:FirmProvider={request:async method=>{if(method==='POST'){confirmations++;throw Error('Timeout');}return f.remote;}};
 assert.equal((await approveFirmPending(db,'ceo',f.id,provider)).state,'uncertain');assert.equal((await approveFirmPending(db,'ceo',f.id,provider)).state,'uncertain');assert.equal(confirmations,1);
});
test('firm confirmation rejects another identity and disallowed tool',async()=>{
 const f=fixture();let confirmations=0;const provider:FirmProvider={request:async method=>{if(method==='POST')confirmations++;return f.remote;}};
 f.remote.identity_id='idn_other';assert.equal((await approveFirmPending(db,'ceo',f.id,provider)).state,'binding_mismatch');f.remote.identity_id=registry.ceo.identity_id;
 f.action.name='wallet.pay';assert.equal((await approveFirmPending(db,'ceo',f.id,provider)).state,'unsupported');assert.equal(confirmations,0);
});
test('firm capacity rejection retries same pending action without duplicate ledger',async()=>{
 const f=fixture();let attempts=0;const provider:FirmProvider={request:async method=>{if(method==='POST'){attempts++;if(attempts===1)throw Object.assign(Error('rate limit'),{status:429});}return f.remote;}};
 await assert.rejects(()=>approveFirmPending(db,'ceo',f.id,provider));assert.equal((await approveFirmPending(db,'ceo',f.id,provider)).state,'confirmed');assert.equal(attempts,2);
 assert.equal((await pool.query("SELECT count(*)::int n FROM advocacy_firm_operations WHERE result->>'session_id'=$1",[f.id])).rows[0].n,1);
});
test('event retry uses frozen request and same provider idempotency key',async()=>{
 const id=randomUUID();events.push(id);const {rows:[event]}=await pool.query("INSERT INTO advocacy_firm_events(id,event_key,role,kind,payload,lease_until) VALUES($1,$2,'ceo','new_case','{}',date_trunc('milliseconds',now())+interval '3 minutes') RETURNING *",[id,`test:${id}`]);
 const keys:string[]=[],bodies:string[]=[];let attempts=0;const remoteId=`ses_${randomUUID()}`;sessions.push(remoteId);
 const provider:FirmProvider={request:async(method,_path,body,key)=>{assert.equal(method,'POST');keys.push(key!);bodies.push(JSON.stringify(body));if(++attempts===1)throw Error('Lost response');return {id:remoteId};}};
 await assert.rejects(()=>advanceFirmEvent(db,event,provider));process.env.ASSURANCE_FIRM_BUDGET_MICRO_USD='2000000';await advanceFirmEvent(db,event,provider);assert.equal(keys[0],keys[1]);assert.equal(bodies[0],bodies[1]);
 const saved=(await pool.query('SELECT session_id,state FROM advocacy_firm_events WHERE id=$1',[id])).rows[0];assert.equal(saved.session_id,remoteId);assert.equal(saved.state,'running');
});
test('scheduled role sessions are discovered and receive scoped approval',async()=>{
 const f=fixture();await pool.query("DELETE FROM advocacy_firm_records WHERE key='firm-approval-discovery'");let confirmations=0;
 const provider:FirmProvider={request:async(method,path)=>{if(path.includes('?'))return {data:[f.remote],has_more:false};if(method==='POST')confirmations++;return f.remote;}};
 assert.equal((await discoverScheduledApprovals(db,provider)).checked,1);assert.equal(confirmations,1);
});

test('queued firm work is not starved by an older running event due for polling',async()=>{
 const old=randomUUID(),queued=randomUUID();events.push(old,queued);const sessionId=`ses_${randomUUID()}`;sessions.push(sessionId);
 await pool.query("INSERT INTO advocacy_firm_events(id,event_key,role,kind,state,session_id,created_at,lease_until) VALUES($1,$2,'ceo','old','running',$3,'1900-01-01',date_trunc('milliseconds',now())-interval '1 second')",[old,`test:${old}`,sessionId]);
 await pool.query("INSERT INTO advocacy_firm_events(id,event_key,role,kind,created_at) VALUES($1,$2,'ceo','new','1901-01-01')",[queued,`test:${queued}`]);
 const newSession=`ses_${randomUUID()}`;sessions.push(newSession);let starts=0;
 const provider:FirmProvider={request:async(method,path)=>{if(path.includes('?'))return {data:[],has_more:false};if(method==='POST'){starts++;return {id:newSession};}throw Error('Older event must not be selected');}};
 const result=await pollFirmEvents(db,provider,{maxEvents:1});assert.equal(result.failed,0);assert.equal(starts,1);
 assert.equal((await pool.query('SELECT session_id FROM advocacy_firm_events WHERE id=$1',[queued])).rows[0].session_id,newSession);
});
test('company provider budget pause records intervention without replacing or waking session',async()=>{
 const id=randomUUID(),sessionId=`ses_${randomUUID()}`;events.push(id);sessions.push(sessionId);
 const {rows:[event]}=await pool.query("INSERT INTO advocacy_firm_events(id,event_key,role,kind,state,session_id,lease_until) VALUES($1,$2,'ceo','budget','running',$3,date_trunc('milliseconds',now())+interval '3 minutes') RETURNING *",[id,`test:${id}`,sessionId]);
 const provider:FirmProvider={request:async(method)=>{assert.equal(method,'GET');return {id:sessionId,agent_id:registry.ceo.agent_id,identity_id:registry.ceo.identity_id,status:'idle',stop_reason:'budget_paused',pending_actions:[]};}};
 await advanceFirmEvent(db,event,provider);const saved=(await pool.query('SELECT state,reason,session_id FROM advocacy_firm_events WHERE id=$1',[id])).rows[0];assert.equal(saved.state,'human_required');assert.equal(saved.session_id,sessionId);assert.match(saved.reason,/budget_paused/);
});

test('native board write is durably denied and redirects the same role to its ledger tool',async()=>{const f=fixture();f.action.name='board_write';let calls=0;const provider:FirmProvider={request:async(method,_path,body)=>{if(method==='POST'){calls++;assert.equal((body as any).decision,'deny');assert.equal((body as any).scope,'call');assert.match((body as any).reason,/firm.update_board_card/);}return f.remote;}};assert.equal((await approveFirmPending(db,'ceo',f.id,provider)).state,'confirmed');await approveFirmPending(db,'ceo',f.id,provider);assert.equal(calls,1);});

test('one hosted tick advances multiple queued roles without parallel provider calls',async()=>{const a=randomUUID(),b=randomUUID();events.push(a,b);for(const[id,role]of[[a,'ceo'],[b,'frontdesk']])await pool.query("INSERT INTO advocacy_firm_events(id,event_key,role,kind,created_at) VALUES($1,$2,$3,'slice-test','1800-01-01')",[id,`test:${id}`,role]);let starts=0,inFlight=false;const provider:FirmProvider={request:async(method,path)=>{assert.equal(inFlight,false);inFlight=true;await Promise.resolve();inFlight=false;if(path.includes('?'))return{data:[],has_more:false};assert.equal(method,'POST');starts++;const id=`ses_${randomUUID()}`;sessions.push(id);return{id};}};const result=await pollFirmEvents(db,provider,{maxEvents:2});assert.equal(result.checked,2);assert.equal(result.failed,0);assert.equal(starts,2);});

test('ended hiring session without a hired advocate records unmet work and never replaces session',async()=>{
 const id=randomUUID(),caseId=randomUUID(),authorityId=randomUUID(),sessionId=`ses_${randomUUID()}`;events.push(id);sessions.push(sessionId);
 await pool.query("INSERT INTO advocacy_cases(id,owner_id,title) VALUES($1,'firm-result-owner','Fictional completion check')",[caseId]);
 await pool.query("INSERT INTO advocacy_case_authorities(id,case_id,approved_by,policy) VALUES($1,$2,'firm-result-owner','{\"version\":2,\"consent\":\"Handle this fictional case\"}')",[authorityId,caseId]);
 await pool.query("INSERT INTO advocacy_firm_staffing(case_id,authority_id,state,budget_micro_usd,budget_reason) VALUES($1,$2,'budgeted',1000,'Recorded CEO allocation')",[caseId,authorityId]);
 await pool.query("INSERT INTO advocacy_firm_events(id,event_key,role,kind,case_id,state,session_id,lease_until) VALUES($1,$2,'frontdesk','budget_allocated',$3,'running',$4,date_trunc('milliseconds',now())+interval '3 minutes')",[id,`test:${id}`,caseId,sessionId]);
 let reads=0;const sends:{path:string;body:any;key?:string}[]=[];const provider:FirmProvider={request:async(method,path,body,key)=>{if(method==='POST'){sends.push({path,body,key});return {accepted_seq:sends.length};}assert.equal(method,'GET');reads++;return {id:sessionId,agent_id:registry.frontdesk.agent_id,identity_id:registry.frontdesk.identity_id,status:'idle',stop_reason:'end_turn'};}};
 try{
  for(let n=1;n<=3;n++){
   const {rows:[current]}=await pool.query('SELECT * FROM advocacy_firm_events WHERE id=$1',[id]);
   await advanceFirmEvent(db,current,provider);
   const during=(await pool.query('SELECT state,session_id FROM advocacy_firm_events WHERE id=$1',[id])).rows[0];
   assert.equal(during.state,'running');assert.equal(during.session_id,sessionId);assert.equal(sends.length,n);assert.equal(sends[n-1].path,`/v1/sessions/${sessionId}/messages`);assert.match(sends[n-1].body.message,/firm\.hire_advocate/);assert.equal(sends[n-1].key,`firm-continue:${id}:${n}`);
  }
  const {rows:[last]}=await pool.query('SELECT * FROM advocacy_firm_events WHERE id=$1',[id]);
  await advanceFirmEvent(db,last,provider);
  const saved=(await pool.query('SELECT state,reason,session_id FROM advocacy_firm_events WHERE id=$1',[id])).rows[0];
  assert.equal(saved.state,'human_required');assert.match(saved.reason,/advocate not hired/);assert.equal(saved.session_id,sessionId);assert.equal(reads,4);assert.equal(sends.length,3);
  assert.equal((await pool.query("SELECT count(*)::int n FROM advocacy_firm_records WHERE key=$1",[`firm-business-unmet:${id}`])).rows[0].n,1);
  assert.equal((await pool.query('SELECT agent_id FROM advocacy_firm_staffing WHERE case_id=$1',[caseId])).rows[0].agent_id,null);
 }finally{
  await pool.query('DELETE FROM advocacy_firm_records WHERE key=$1',[`firm-business-unmet:${id}`]);await pool.query('DELETE FROM advocacy_firm_events WHERE id=$1',[id]);await pool.query('DELETE FROM advocacy_firm_staffing WHERE case_id=$1',[caseId]);await pool.query('DELETE FROM advocacy_case_authorities WHERE id=$1',[authorityId]);await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[caseId]);
 }
});


test('business completion requires the bound advocate first turn and saved CEO rationale',async()=>{
 const event={role:'frontdesk',kind:'budget_allocated',case_id:randomUUID()} as any;
 const row:any={staffing_state:'active',budget_micro_usd:1000,budget_reason:'Evidence-based allocation',agent_id:'agt_case',authority_state:'active',owner_bound:true,run_id:randomUUID(),session_id:'ses_case',run_state:'running',run_bound:true,credential_bound:true,first_turn:false};
 const readDb={execute:async()=>({rows:[row]})} as any;
 assert.equal((await firmBusinessResult(readDb,event)).state,'running');
 row.run_state='idle';assert.equal((await firmBusinessResult(readDb,event)).state,'human_required');row.run_state='running';
 row.first_turn=true;assert.equal((await firmBusinessResult(readDb,event)).state,'finished');
 row.run_state='human_required';row.authority_state='human_required';assert.equal((await firmBusinessResult(readDb,event)).state,'finished');row.run_state='running';row.authority_state='active';
 row.credential_bound=false;assert.equal((await firmBusinessResult(readDb,event)).state,'human_required');
 const budgetEvent={...event,role:'ceo',kind:'budget_needed'};
 assert.equal((await firmBusinessResult(readDb,budgetEvent)).state,'finished');
 row.budget_reason=null;assert.equal((await firmBusinessResult(readDb,budgetEvent)).state,'human_required');
 row.authority_state='revoked';assert.equal((await firmBusinessResult(readDb,budgetEvent)).state,'human_required');
 row.authority_state='active';row.staffing_state='requested';row.dependency_pending=true;
 assert.equal((await firmBusinessResult(readDb,{...event,kind:'new_case'})).state,'running');
 row.dependency_pending=false;assert.equal((await firmBusinessResult(readDb,{...event,kind:'new_case'})).state,'human_required');
 row.staffing_state='hiring';row.provision_pending=true;assert.equal((await firmBusinessResult(readDb,event)).state,'running');
 row.provision_pending=false;assert.equal((await firmBusinessResult(readDb,event)).state,'running');
});

test('one event tick confirms an already pending batch without duplicate dispatch',async()=>{
 const f=fixture(),id=randomUUID();events.push(id);
 const second={...f.action,tool_call_id:'call_2',parked_seq:2};f.remote.pending_actions.push(second);
 const {rows:[event]}=await pool.query("INSERT INTO advocacy_firm_events(id,event_key,role,kind,state,session_id,lease_until) VALUES($1,$2,'ceo','batch-check','running',$3,date_trunc('milliseconds',now())+interval '3 minutes') RETURNING *",[id,`test:${id}`,f.id]);
 const confirmed:string[]=[];const provider:FirmProvider={request:async(method,_path,body)=>{if(method==='POST'){const call=(body as any).tool_call_id;assert.equal(call,f.remote.pending_actions[0].tool_call_id);confirmed.push(call);f.remote.pending_actions.shift();}return structuredClone(f.remote);}};
 await advanceFirmEvent(db,event,provider);assert.deepEqual(confirmed,['call_1','call_2']);
 assert.equal((await pool.query("SELECT count(*)::int n FROM advocacy_firm_operations WHERE result->>'session_id'=$1 AND state='completed'",[f.id])).rows[0].n,2);
});
test('an approval tells the role to repeat the same call next',async()=>{const f=fixture();const bodies:any[]=[];const provider:FirmProvider={request:async(method,path,body)=>{if(method==='POST'){bodies.push(body);return {};}return f.remote;}};
 assert.equal((await approveFirmPending(db,'ceo',f.id,provider)).state,'confirmed');assert.equal(bodies[0].decision,'allow');assert.match(bodies[0].reason,/Call firm\.firm_status again now with exactly the same arguments/);
});

