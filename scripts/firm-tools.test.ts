import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firmToolsRoutes} from '../backend/firm-tools';
import {firmRoles} from '../backend/firm-blueprint';
process.env.ASSURANCE_FIRM_ENABLED='true';
const tokens=Object.fromEntries(firmRoles.map(role=>[role,`${role}-${'x'.repeat(40)}`]));process.env.ASSURANCE_FIRM_TOKENS=JSON.stringify(tokens);
let executions=0;
const app=firmToolsRoutes({} as never,async(_db,role,name,args)=>{executions++;return {role,name,args};});
const request=(role:string,token:string,method='tools/list',params:unknown={},origin?:string)=>app.request(`/mcp/${role}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(origin?{Origin:origin}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
test('firm bearer binds exactly one role and rejects browser origins',async()=>{
 assert.equal((await request('ceo',tokens.growth)).status,401);assert.equal((await request('other',tokens.ceo)).status,401);assert.equal((await request('ceo',tokens.ceo,'tools/list',{},'https://example.com')).status,403);assert.equal(executions,0);
});
test('role discovery exposes only role tools and cannot invoke an undeclared tool',async()=>{
 const result=await (await request('growth',tokens.growth)).json();assert.ok(result.result.tools.some((t:any)=>t.name==='record_growth_lead'));assert.ok(!result.result.tools.some((t:any)=>t.name==='set_case_budget'));
 const called=await (await request('growth',tokens.growth,'tools/call',{name:'set_case_budget',arguments:{}})).json();assert.ok(called.error||called.result?.isError);assert.equal(executions,0);
});
test('validated role call reaches service with server-selected role',async()=>{
 const result=await (await request('ceo',tokens.ceo,'tools/call',{name:'firm_status',arguments:{}})).json();assert.equal(JSON.parse(result.result.content[0].text).role,'ceo');assert.equal(executions,1);
});
