import {test} from "node:test";
import assert from "node:assert/strict";
import {verifyCaseBinding,caseBindingMatches,type BindingEvidence} from "../backend/providers/case-binding";
const binding={case_id:"11111111-1111-4111-8111-111111111111",identity_id:"idn_case",agent_id:"agt_case",agent_version:19},base="https://example.com/mcp";
const evidence:BindingEvidence={version:{version:19,mcp_servers:[{name:"assurance",url:`${base}/${binding.case_id}`}],tools:{default_config:{permission:"deny"}},budget:{period:"month",cap_micro_usd:2000000,max_task_micro_usd:250000}},identity:{id:binding.identity_id,metadata:{case_id:binding.case_id}},attachedAgentIds:[binding.agent_id]};
test("only the case-specific pinned connector and approved budget match",()=>{
 assert.equal(caseBindingMatches(binding,base,evidence),true);
 for(const mutate of [(e:BindingEvidence)=>{e.version.mcp_servers[0].url=base;},(e:BindingEvidence)=>{e.version.mcp_servers[0].url=base+"/22222222-2222-4222-8222-222222222222";},(e:BindingEvidence)=>{e.version.version=20;},(e:BindingEvidence)=>{e.identity.metadata.case_id="other";},(e:BindingEvidence)=>{e.attachedAgentIds=[];},(e:BindingEvidence)=>{e.version.budget.cap_micro_usd=3000000;},(e:BindingEvidence)=>{e.version.tools.default_config.permission="allow";},(e:BindingEvidence)=>{e.version.mcp_servers[0].headers={Authorization:"synthetic-secret"};}]){const copy=structuredClone(evidence);mutate(copy);assert.equal(caseBindingMatches(binding,base,copy),false);}
});

test("binding reads finish sequentially under single-request admission",async()=>{
 const prior=process.env.NAIVE_CASE_TOOLS_URL;process.env.NAIVE_CASE_TOOLS_URL=base;
 let active=0;const order:string[]=[];
 async function read<T>(name:string,value:T){assert.equal(active,0,"overlapping provider request");active++;order.push(name);await new Promise(resolve=>setTimeout(resolve,5));active--;return value;}
 try{
  assert.equal(await verifyCaseBinding(binding,{agents:{getVersion:()=>read("version",evidence.version)},identities:{get:()=>read("identity",evidence.identity),agents:()=>read("attachments",{data:[{id:binding.agent_id}]})}}),true);
  assert.deepEqual(order,["version","identity","attachments"]);
 }finally{if(prior===undefined)delete process.env.NAIVE_CASE_TOOLS_URL;else process.env.NAIVE_CASE_TOOLS_URL=prior;}
});
