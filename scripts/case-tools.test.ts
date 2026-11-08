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

test("shared MCP URL derives case access solely from the bearer credential",async()=>{
 const shared=caseTools({authenticate:async token=>token==="a"?{id:"a",case_id:caseId,owner_id:"owner"}:token==="b"?{id:"b",case_id:other,owner_id:"owner"}:null,getCase:async identity=>({case_id:identity.case_id}),recordFact:async()=>{throw Error("unexpected write");}});
 for(const [token,own,wrong] of [["a",caseId,other],["b",other,caseId]]){
  for(const target of [own,wrong]){
   const response=await shared.request("/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream",Authorization:`Bearer ${token}`},body:rpc("tools/call",{name:"case_get",arguments:{case_id:target}})});
   const result=(await response.json()).result;
   if(target===own)assert.equal(JSON.parse(result.content[0].text).case_id,own);else assert.equal(result.isError,true);
  }
 }
});

test("citation tool refuses another case before fetching a URL",async()=>{
 let fetches=0;const sourceApp=caseTools({authenticate:async()=>({id:"credential",case_id:caseId,owner_id:"owner"}),getCase:async()=>({}),recordFact:async()=>({}),citeSource:async()=>{fetches++;return{};}});
 const response=await sourceApp.request("/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream",Authorization:"Bearer valid"},body:rpc("tools/call",{name:"cite_source",arguments:{case_id:other,operation_id:caseId,url:"https://example.com/",quote:"A fictional quote that must not be fetched"}})});
 assert.equal((await response.json()).result.isError,true);assert.equal(fetches,0);
});

test("native email tool requires its authenticated case and passes a fixed channel",async()=>{
 const actions:unknown[]=[];const nativeApp=caseTools({authenticate:async()=>({id:"credential",case_id:caseId,owner_id:"owner"}),getCase:async()=>({}),recordFact:async()=>({}),takeAction:async(_identity,input)=>{actions.push(input);return {state:"finished",action:{state:"submitted"}};}});
 const args={case_id:other,operation_id:caseId,authority_id:caseId,contact_id:"customer",role:"customer",subject:"Synthetic test",body:"Fictional question?",reason:"Missing detail",evidence_refs:["case:1"]};
 const call=async(input:unknown)=>{const res=await nativeApp.request("/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream",Authorization:"Bearer valid"},body:rpc("tools/call",{name:"send_email",arguments:input})});return (await res.json()).result;};
 assert.equal((await call(args)).isError,true);assert.equal(actions.length,0);
 assert.notEqual((await call({...args,case_id:caseId})).isError,true);assert.equal((actions[0] as {channel:string}).channel,"email");
 assert.equal((await call({...args,case_id:caseId,subject:"Unsafe\r\nHeader"})).isError,true);assert.equal(actions.length,1);
});

test('goal tool enforces case binding and rejects malformed finish conditions before saving',async()=>{
 let saves=0;const goalApp=caseTools({authenticate:async()=>({id:'credential',case_id:caseId,owner_id:'owner'}),getCase:async()=>({}),recordFact:async()=>({}),setGoal:async(_identity,input)=>{saves++;return input;}});
 const call=async(args:unknown)=>(await (await goalApp.request('/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer valid'},body:rpc('tools/call',{name:'set_goal',arguments:args})})).json()).result;
 assert.equal((await call({case_id:other,goal:'Resolve claim',finish_condition:'Documented decision'})).isError,true);
 assert.equal((await call({case_id:caseId,goal:'Resolve claim',finish_condition:''})).isError,true);assert.equal(saves,0);
 assert.equal(JSON.parse((await call({case_id:caseId,goal:'Resolve claim',finish_condition:'Documented decision'})).content[0].text).goal,'Resolve claim');assert.equal(saves,1);
});
