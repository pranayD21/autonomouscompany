import {test} from "node:test";
import assert from "node:assert/strict";
import {caseTools} from "../backend/case-tools";
const caseId="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
let writes=0;
const app=caseTools({authenticate:async t=>t==="valid"?{id:"credential",case_id:caseId,owner_id:"owner"}:null,getCase:async()=>({case_id:caseId}),recordFact:async()=>{writes++;return{id:"fact"}}});
const rpc=(method:string,params:unknown={})=>JSON.stringify({jsonrpc:"2.0",id:1,method,params});
function req(path=caseId,token:string|null="valid",body=rpc("tools/list"),origin?:string){return app.request(`/mcp/${path}`,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream",...(token?{Authorization:`Bearer ${token}`}:{ }),...(origin?{Origin:origin}:{})},body});}
test("MCP requires authentication and rejects another case before tools run",async()=>{
 assert.equal((await req(caseId,null)).status,401);assert.equal((await req(caseId,"wrong")).status,401);assert.equal((await req(other)).status,403);assert.equal((await req(caseId,"valid",rpc("tools/list"),"https://attacker.example")).status,403);assert.equal(writes,0);
});
test("MCP initialization and tool discovery use the standard protocol",async()=>{
 const r=await req(caseId,"valid",rpc("initialize",{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"test",version:"1"}}));assert.equal(r.status,200);assert.equal((await r.json()).result.serverInfo.name,"assurance");
 const list=await (await req()).json();assert.deepEqual(list.result.tools.map((t:{name:string})=>t.name),["case_get","case_record_fact"]);
});
test("tool case argument cannot override the authenticated case",async()=>{
 const result=await (await req(caseId,"valid",rpc("tools/call",{name:"case_record_fact",arguments:{case_id:other,operation_id:other,statement:"Fictional fact",source_ref:"case:1"}}))).json();assert.equal(result.result.isError,true);assert.equal(writes,0);
});
test("authenticated case_get returns its own case",async()=>{
 const r=await (await req(caseId,"valid",rpc("tools/call",{name:"case_get",arguments:{case_id:caseId}}))).json();assert.equal(JSON.parse(r.result.content[0].text).case_id,caseId);
});
