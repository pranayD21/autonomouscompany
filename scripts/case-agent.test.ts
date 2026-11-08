import {test} from "node:test";
import assert from "node:assert/strict";
import {caseAgentTools,caseSessionInput} from "../backend/providers/case-agent";
test("case session pins its acting identity and version without credentials in model context",()=>{
 const input=caseSessionInput({agentId:"agent",agentVersion:18,identityId:"identity-case-a",caseId:"case-a",budget:250000,message:"Read the case"});
 assert.equal(input.identity,"identity-case-a");assert.equal(input.agent_version,18);assert.equal(input.metadata?.case_id,"case-a");
 for(const budget of [0,-1,250001,NaN,1.5])assert.throws(()=>caseSessionInput({agentId:"agent",agentVersion:18,identityId:"identity",caseId:"case",budget,message:"Read"}),/budget/);
});
test("case tools reject secret-bearing URLs and expose only explicit tools",()=>{
 for(const url of ["http://example.com/mcp","https://user:pass@example.com/mcp","https://example.com/mcp?token=secret","https://example.com/mcp#secret","https://example.com/other"])assert.throws(()=>caseAgentTools(url));
 const config=caseAgentTools("https://example.com/mcp");assert.equal(config.tools.default_config.permission,"deny");assert.equal(config.tools.configs["assurance.case_get"].permission,"allow");assert.equal("headers" in config.mcp_servers[0],false);
});
