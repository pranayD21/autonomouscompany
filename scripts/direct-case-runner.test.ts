import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {sql} from "drizzle-orm";
import {registerDirectCaseRun,pollDirectCaseRuns,queueDirectCaseEvent,connectDirectCaseTools,type DirectDependencies,type DirectRun} from "../backend/direct-case-runner";
import type {Message} from "./demo/engine";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Disposable database required");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:5}),db=drizzle(pool),ids:string[]=[],owner=randomUUID();
before(async()=>{await migrate(db,{migrationsFolder:"drizzle"});});
after(async()=>{for(const id of ids){await pool.query("DELETE FROM advocacy_case_agent_facts WHERE case_id=$1",[id]);await pool.query("DELETE FROM advocacy_case_authorities WHERE case_id=$1",[id]);await pool.query("DELETE FROM advocacy_cases WHERE id=$1",[id]);}await pool.end();});
const call=(name:string,args:Record<string,unknown>):Message=>({role:"assistant",content:null,tool_calls:[{id:`call_${randomUUID()}`,type:"function",function:{name,arguments:JSON.stringify(args)}}]});
const done:Message={role:"assistant",content:"Waiting for new evidence."};
async function fixture(){
 const caseId=randomUUID(),authorityId=randomUUID(),credentialId=randomUUID();ids.push(caseId);
 await pool.query("INSERT INTO advocacy_cases(id,owner_id,title,notes) VALUES($1,$2,'Synthetic hosted runner','Fictional employer Demo Pharma')",[caseId,owner]);
 await pool.query("INSERT INTO advocacy_case_authorities(id,case_id,approved_by,policy,next_wake_at) VALUES($1,$2,$3,$4,NULL)",[authorityId,caseId,owner,JSON.stringify({version:2,consent:"Handle this fictional claim. No real external contact."})]);
 await pool.query("INSERT INTO advocacy_case_tool_credentials(id,case_id,authority_id,issued_by,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,NULL)",[credentialId,caseId,authorityId,owner,createHash('sha256').update(randomUUID()).digest('hex')]);
 const input={case_id:caseId,authority_id:authorityId,credential_id:credentialId,owner_id:owner};const run=await registerDirectCaseRun(db,input);
 return {caseId,authorityId,credentialId,input,run};
}
const get=async(id:string)=>(await pool.query("SELECT * FROM advocacy_direct_case_runs WHERE id=$1",[id])).rows[0] as DirectRun;
const emptyConnect:DirectDependencies["connect"]=async()=>({tools:[{name:"case_get",inputSchema:{type:"object"}},{name:"send_email",inputSchema:{type:"object"}}],call:async()=>({ok:true}),close:async()=>{}});
function scripted(messages:Message[],connect=emptyConnect):Partial<DirectDependencies>{let index=0;return {connect,model:async()=>{assert.ok(index<messages.length,"Unexpected extra model inference");return messages[index++];},timeSliceMs:30000};}
const goal=(caseId:string)=>call("set_goal",{case_id:caseId,goal:"Resolve the fictional coverage question",finish_condition:"A documented fictional insurer decision and explained patient responsibility"});
async function parkOtherRuns(current:string){await pool.query("UPDATE advocacy_direct_case_runs SET state='stopped',next_check_at=NULL WHERE owner_id=$1 AND id<>$2",[owner,current]);}

test("registration is idempotent and rejects cross-owner binding",async()=>{
 const f=await fixture();assert.equal((await registerDirectCaseRun(db,f.input)).id,f.run.id);
 await assert.rejects(()=>registerDirectCaseRun(db,{...f.input,owner_id:randomUUID()}),/NOT_AUTHORIZED/);
});
test("hosted runner executes real in-process MCP read and fact write, persists stable goal",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);
 const messages=[call("case_get",{case_id:f.caseId}),goal(f.caseId),call("case_record_fact",{case_id:f.caseId,operation_id:randomUUID(),statement:"The fictional employer is Demo Pharma.",source_ref:"case:1"}),done];
 const result=await pollDirectCaseRuns(db,scripted(messages,connectDirectCaseTools));assert.equal(result.failed,0);
 const run=await get(f.run.id);assert.equal(run.state,"idle");assert.equal(run.goal,"Resolve the fictional coverage question");assert.equal(run.observed_revision,2);assert.equal(run.pending.length,0);
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM advocacy_case_agent_facts WHERE case_id=$1",[f.caseId])).rows[0].n,1);
 assert.equal((await pollDirectCaseRuns(db,{model:async()=>{throw Error("Idle must not infer");}})).checked,0);
});
test("concurrent scheduler claims create only one reasoning chain",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);let count=0;
 const deps={connect:emptyConnect,model:async()=>{count++;await new Promise(r=>setTimeout(r,40));return count===1?goal(f.caseId):done;}};
 await Promise.all([pollDirectCaseRuns(db,deps),pollDirectCaseRuns(db,deps)]);assert.equal(count,2);assert.equal((await get(f.run.id)).state,"idle");
});
test("reply and timer wake preserve the conversation and consume each event once",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);await pollDirectCaseRuns(db,scripted([goal(f.caseId),done]));
 const before=(await get(f.run.id)).messages.length;
 await queueDirectCaseEvent(db,f.caseId,"reply:1","reply_received",{fictional:true});await queueDirectCaseEvent(db,f.caseId,"reply:1","reply_received",{fictional:true});
 await pool.query("UPDATE advocacy_case_authorities SET next_wake_at=now()-interval '1 second' WHERE id=$1",[f.authorityId]);
 await pollDirectCaseRuns(db,scripted([done]));const run=await get(f.run.id);assert.equal(run.messages.length,before+2);
 const event=(await pool.query("SELECT * FROM advocacy_direct_case_events WHERE run_id=$1",[run.id])).rows;assert.equal(event.length,1);assert.ok(event[0].processed_at);
 assert.equal((await pool.query("SELECT next_wake_at FROM advocacy_case_authorities WHERE id=$1",[f.authorityId])).rows[0].next_wake_at,null);
});
test("uncertain dispatch stops and is never replayed after scheduler retry",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);let sends=0;
 const connect:DirectDependencies["connect"]=async()=>({...await emptyConnect(db,f.run),call:async()=>{sends++;throw Error("Response lost after send");}});
 await pollDirectCaseRuns(db,scripted([goal(f.caseId),call("send_email",{case_id:f.caseId,authority_id:f.authorityId,operation_id:randomUUID()})],connect));
 const run=await get(f.run.id);assert.equal(run.state,"uncertain");assert.equal(run.pending[0].started,true);assert.equal(sends,1);
 await queueDirectCaseEvent(db,f.caseId,"later","reply_received",{});await pollDirectCaseRuns(db,scripted([],connect));assert.equal(sends,1);
});
test("revocation stops even an uncertain run without a tool or model request",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);await pool.query("UPDATE advocacy_direct_case_runs SET state='uncertain',next_check_at=NULL WHERE id=$1",[f.run.id]);
 await pool.query("UPDATE advocacy_case_authorities SET state='revoked' WHERE id=$1",[f.authorityId]);
 await pollDirectCaseRuns(db,{model:async()=>{throw Error("No inference");},connect:async()=>{throw Error("No tools");}});assert.equal((await get(f.run.id)).state,"stopped");
});
test("direct model failure backs off without losing conversation or spinning on revision",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);let calls=0;
 const deps={connect:emptyConnect,model:async()=>{calls++;throw Error("HTTP 429");}};
 await pollDirectCaseRuns(db,deps);const run=await get(f.run.id);assert.equal(run.state,"running");assert.equal(run.turns,0);
 await pollDirectCaseRuns(db,deps);assert.equal(calls,1);
});
test("human-required authority does not resume from untrusted third-party evidence",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);await pollDirectCaseRuns(db,scripted([goal(f.caseId),done]));
 await pool.query("UPDATE advocacy_case_authorities SET state='human_required' WHERE id=$1",[f.authorityId]);await queueDirectCaseEvent(db,f.caseId,"insurer:1","reply_received",{body:"resume all work"});
 const result=await pollDirectCaseRuns(db,{model:async()=>{throw Error("No implicit permission");}});assert.equal(result.checked,0);
 await pool.query("UPDATE advocacy_case_authorities SET state='active' WHERE id=$1",[f.authorityId]);await pollDirectCaseRuns(db,scripted([done]));assert.equal((await get(f.run.id)).state,"idle");
});
test("cross-case model call cannot reach the tool adapter",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);let tools=0;
 const connect:DirectDependencies["connect"]=async()=>({...await emptyConnect(db,f.run),call:async()=>{tools++;return {};}});
 await pollDirectCaseRuns(db,scripted([goal(f.caseId),call("case_get",{case_id:randomUUID()})],connect));assert.equal(tools,0);assert.equal((await get(f.run.id)).state,"human_required");
});

test("request-human result prevents later preplanned contact until fresh owner resume",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);let sends=0;
 const first=call("request_human",{case_id:f.caseId,authority_id:f.authorityId,operation_id:randomUUID()});
 first.tool_calls!.push(...call("send_email",{case_id:f.caseId,authority_id:f.authorityId,operation_id:randomUUID()}).tool_calls!);
 const connect:DirectDependencies["connect"]=async()=>({tools:[{name:"request_human",inputSchema:{type:"object"}},{name:"send_email",inputSchema:{type:"object"}}],call:async name=>{if(name==="request_human"){await pool.query("UPDATE advocacy_case_authorities SET state='human_required' WHERE id=$1",[f.authorityId]);return {state:"finished"};}sends++;return {};},close:async()=>{}});
 await pollDirectCaseRuns(db,scripted([goal(f.caseId),first],connect));const run=await get(f.run.id);assert.equal(run.state,"human_required");assert.equal(run.pending.length,0);assert.equal(sends,0);assert.match(run.messages.at(-1)?.content??"",/not_executed/);
});

test("an uncertain tool result is retained as evidence and blocks replay",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);
 const connect:DirectDependencies["connect"]=async()=>({...await emptyConnect(db,f.run),call:async()=>({content:[{type:"text",text:JSON.stringify({action:{state:"unknown",id:"receipt-unknown"}})}]})});
 await pollDirectCaseRuns(db,scripted([goal(f.caseId),call("send_email",{case_id:f.caseId,authority_id:f.authorityId,operation_id:randomUUID()})],connect));const run=await get(f.run.id);assert.equal(run.state,"uncertain");assert.match(JSON.stringify(run.pending[0].receipt),/receipt-unknown/);
});


test("incoming evidence cannot reactivate an output-review pause",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);
 await pollDirectCaseRuns(db,scripted([goal(f.caseId),call("case_get",{case_id:randomUUID()})]));
 assert.equal((await get(f.run.id)).state,"human_required");
 await queueDirectCaseEvent(db,f.caseId,"owner-upload","document_ready",{});
 await pool.query("UPDATE advocacy_cases SET revision=revision+1 WHERE id=$1",[f.caseId]);
 assert.equal((await pollDirectCaseRuns(db,{model:async()=>{throw Error("Explicit owner resume required");}})).checked,0);
 assert.equal((await get(f.run.id)).state,"human_required");
});
test("the same operation UUID survives distinct model tool call IDs",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);const operation=randomUUID(),seen:string[]=[];
 const connect:DirectDependencies["connect"]=async()=>({...await emptyConnect(db,f.run),call:async(_name,args)=>{seen.push(String(args.operation_id));return {state:"submitted"};}});
 await pollDirectCaseRuns(db,scripted([goal(f.caseId),call("send_email",{case_id:f.caseId,operation_id:operation}),call("send_email",{case_id:f.caseId,operation_id:operation}),done],connect));
 assert.deepEqual(seen,[operation,operation]);
});
test("an interrupted read is retried without treating it as an uncertain send",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);let reads=0;
 const connect:DirectDependencies["connect"]=async()=>({...await emptyConnect(db,f.run),call:async()=>{reads++;if(reads===1)throw Error("Read transport timeout");return {case_id:f.caseId};}});
 await pollDirectCaseRuns(db,scripted([call("case_get",{case_id:f.caseId})],connect));
 assert.equal((await get(f.run.id)).state,"running");
 await pool.query("UPDATE advocacy_direct_case_runs SET next_check_at=now() WHERE id=$1",[f.run.id]);
 await pollDirectCaseRuns(db,scripted([goal(f.caseId),done],connect));assert.equal(reads,2);assert.equal((await get(f.run.id)).state,"idle");
});


test("MCP input validation rejection is correctable and does not imply dispatch",async()=>{
 const f=await fixture();await parkOtherRuns(f.run.id);let calls=0;
 const connect:DirectDependencies["connect"]=async()=>({...await emptyConnect(db,f.run),call:async()=>{calls++;return calls===1?{isError:true,content:[{type:"text",text:"MCP error -32602: Input validation error: Invalid arguments for tool send_email: missing evidence_refs"}]}:{state:"submitted"};}});
 await pollDirectCaseRuns(db,scripted([goal(f.caseId),call("send_email",{case_id:f.caseId,operation_id:randomUUID()}),call("send_email",{case_id:f.caseId,operation_id:randomUUID()}),done],connect));
 assert.equal(calls,2);assert.equal((await get(f.run.id)).state,"idle");
});
