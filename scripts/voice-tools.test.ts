import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {voiceToolRoutes} from '../backend/voice-tools';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable database required');
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full'),max:4}),users:string[]=[],owners:string[]=[],cases:string[]=[];
const env={...process.env};
before(async()=>{await migrate(drizzle(pool),{migrationsFolder:'drizzle'});Object.assign(process.env,{AGENTPHONE_TOOL_SECRET:'fixture-secret',AGENTPHONE_API_KEY:'fake',AGENTPHONE_AGENT_ID:'agt',AGENTPHONE_NUMBER_ID:'num'});});
after(async()=>{
 await pool.query('DELETE FROM advocacy_phone_call_cases WHERE owner_id=ANY($1)',[owners]);
 for(const table of ['advocacy_case_messages','advocacy_case_authorities'])await pool.query(`DELETE FROM ${table} WHERE case_id=ANY($1)`,[cases]);
 await pool.query('DELETE FROM advocacy_cases WHERE id=ANY($1)',[cases]);await pool.query('DELETE FROM advocacy_phone_users WHERE id=ANY($1)',[users]);await pool.end();
 for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);
});
async function caller(){const id=randomUUID(),phone=`+1555${String(1000000+users.length+Math.floor(Math.random()*8000000))}`;users.push(id);owners.push(`phone:${id}`);await pool.query('INSERT INTO advocacy_phone_users(id,name,email,phone_number,phone_number_verified) VALUES($1,$2,$3,$4,true)',[id,'Fictional caller',`${id}@phone.test`,phone]);return {owner:`phone:${id}`,phone};}
async function openCase(owner:string,title:string){const id=randomUUID();cases.push(id);await pool.query("INSERT INTO advocacy_cases(id,owner_id,title,case_type,intake) VALUES($1,$2,$3,'workplace_injury',$4)",[id,owner,title,JSON.stringify({injury_description:'Fictional burn at the plant.',member_id:'MEMBER-SECRET',claim_number:'CLAIM-SECRET'})]);await pool.query('INSERT INTO advocacy_case_authorities(id,case_id,approved_by,policy) VALUES($1,$2,$3,$4)',[randomUUID(),id,owner,JSON.stringify({version:2,consent:'Handle this fictional claim.'})]);return id;}
function server(live:unknown[]){
 const app=voiceToolRoutes(pool,{request:(async url=>{assert.match(String(url),/status=in-progress/);return Response.json({data:live});}) as typeof fetch});
 return (tool:string,body:unknown={},secret='fixture-secret')=>app.request(`/${tool}`,{method:'POST',headers:{'x-assurance-tool-secret':secret,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
const inbound=(id:string,fromNumber:string)=>({id,agentId:'agt',phoneNumberId:'num',direction:'inbound',status:'in-progress',fromNumber});

test('requests without the shared secret get nothing',async()=>{
 const res=await server([])('get_open_cases',{},'wrong');assert.equal(res.status,401);
});
test('a caller with no open cases is told so, and an unknown caller learns nothing',async()=>{
 const u=await caller();
 assert.deepEqual(await (await server([inbound('c1',u.phone)])('get_open_cases')).json(),{caller_known:true,count:0,cases:[]});
 const stranger=await (await server([inbound('c2','+15550000001')])('get_open_cases')).json();assert.equal(stranger.caller_known,false);assert.equal(stranger.count,0);
});
test('several live calls reveal nothing unless the request names a live caller',async()=>{
 const a=await caller(),b=await caller();await openCase(a.owner,'Case for A');await openCase(b.owner,'Case for B');
 const both=[inbound('c3',a.phone),inbound('c4',b.phone)];
 assert.equal((await (await server(both)('get_open_cases')).json()).caller_known,false);
 const named=await (await server(both)('get_open_cases',{call:{from_number:b.phone}})).json();assert.deepEqual(named.cases.map((c:{title:string})=>c.title),['Case for B']);
 assert.equal((await (await server(both)('get_open_cases',{call:{from_number:'+15550000002'}})).json()).caller_known,false);
});
test('details stay within the caller\'s cases, omit identifiers, and mark the call as about that case',async()=>{
 const u=await caller(),other=await caller();const id=await openCase(u.owner,'Burn at the plant');await openCase(other.owner,'Someone else');
 const ask=server([inbound('c5',u.phone)]);
 const listed=await (await ask('get_open_cases')).json();assert.equal(listed.count,1);assert.equal(listed.cases[0].type,'workplace injury');
 const res=await ask('get_case_details',{args:{case_number:1}});const text=await res.text();const detail=JSON.parse(text);
 assert.equal(detail.title,'Burn at the plant');assert.match(detail.what_was_reported,/Fictional burn/);assert.doesNotMatch(text,/MEMBER-SECRET|CLAIM-SECRET/);
 assert.equal((await pool.query('SELECT state,case_id FROM advocacy_phone_call_cases WHERE call_id=$1',['c5'])).rows[0].case_id,id);
 assert.match((await (await ask('get_case_details',{case_number:2})).json()).error,/not found/);
});
test('an update lands once in that case\'s conversation',async()=>{
 const u=await caller();const id=await openCase(u.owner,'Burn at the plant');const ask=server([inbound('c6',u.phone)]);
 const first=await (await ask('save_case_update',{case_number:1,update:'The clinic sent a new bill.'})).json();assert.equal(first.saved,true);
 assert.equal((await (await ask('save_case_update',{case_number:1,update:'The clinic sent a new bill.'})).json()).saved,true);
 const {rows}=await pool.query("SELECT count(*)::int AS n FROM advocacy_case_messages WHERE case_id=$1",[id]);assert.equal(rows[0].n,1);
 assert.equal((await (await ask('save_case_update',{case_number:1,update:' '})).json()).saved,false);
});
test('stopped cases are not offered',async()=>{
 const u=await caller();const id=await openCase(u.owner,'Stopped case');await pool.query("UPDATE advocacy_case_authorities SET state='revoked' WHERE case_id=$1",[id]);
 assert.equal((await (await server([inbound('c7',u.phone)])('get_open_cases')).json()).count,0);
});
