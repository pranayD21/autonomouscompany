import {test} from "node:test";import assert from "node:assert/strict";import {runDemoTurn,directModel,type State,type Message} from "./engine";
const state=():State=>({version:1,caseId:"case1",turns:0,messages:[],pending:[]});
const tool={name:"send_email",inputSchema:{type:"object"}};
const call:Message={role:"assistant",content:null,tool_calls:[{id:"call1",type:"function",function:{name:"send_email",arguments:JSON.stringify({case_id:"case1",operation_id:"same-operation"})}}]};
test("real tool receipt is supplied to model and conversation persists across turns",async()=>{
 const s=state();let calls=0,models=0;const saves:State[]=[];
 const answer=await runDemoTurn(s,[tool],{model:async(messages)=>{models++;if(models===1)return call;assert.equal(messages.at(-1)?.role,"tool");assert.match(messages.at(-1)?.content??"",/receipt1/);return {role:"assistant",content:"Waiting for reply"};},tool:async()=>{calls++;return {receipt:"receipt1"};},save:async x=>{saves.push(structuredClone(x));}});
 assert.equal(answer,"Waiting for reply");assert.equal(calls,1);assert.equal(s.pending.length,0);assert.ok(saves.some(x=>x.pending[0]?.started));
});
test("uncertain tool dispatch is not automatically replayed after restart",async()=>{
 const s=state();let calls=0;let saved:State=s;
 const deps={model:async()=>call,tool:async()=>{calls++;throw Error("lost response");},save:async(x:State)=>{saved=structuredClone(x);}};
 await assert.rejects(()=>runDemoTurn(s,[tool],deps),/lost response/);
 await assert.rejects(()=>runDemoTurn(saved,[tool],deps),/RECONCILIATION_REQUIRED/);assert.equal(calls,1);
});
test("cross-case model calls cannot execute",async()=>{
 const s=state();let calls=0;const bad=structuredClone(call);bad.tool_calls![0].function.arguments='{"case_id":"other"}';
 await assert.rejects(()=>runDemoTurn(s,[tool],{model:async()=>bad,tool:async()=>{calls++;},save:async()=>{}}),/MISMATCH/);assert.equal(calls,0);
});
test("model rate limit is surfaced without hidden retry or tool execution",async()=>{
 let requests=0;const model=directModel("test-secret","test-model",async()=>{requests++;return new Response("",{status:429});});
 await assert.rejects(()=>model([],[]),/HTTP_429/);assert.equal(requests,1);
});
