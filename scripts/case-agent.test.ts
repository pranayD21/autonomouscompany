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
 const config=caseAgentTools("https://example.com/mcp","11111111-1111-4111-8111-111111111111");assert.equal(config.tools.default_config.permission,"deny");assert.equal(config.tools.configs["assurance.case_get"].permission,"allow");assert.equal("headers" in config.mcp_servers[0],false);
});

test("case-specific connector URL separates provider sessions and rejects malformed case IDs",()=>{
 const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
 assert.equal(caseAgentTools("https://example.com/mcp",a).mcp_servers[0].url,`https://example.com/mcp/${a}`);
 assert.notEqual(caseAgentTools("https://example.com/mcp",a).mcp_servers[0].url,caseAgentTools("https://example.com/mcp",b).mcp_servers[0].url);
 assert.throws(()=>caseAgentTools("https://example.com/mcp","../other"));
 assert.throws(()=>caseAgentTools("https://example.com/mcp"));
 assert.throws(()=>caseAgentTools(`https://example.com/mcp/${b}`,a));
 assert.throws(()=>caseAgentTools("https://example.com/other",a));
});

test("Gmail discovery exposes only read operations under denied default",()=>{const config=caseAgentTools("https://example.com/mcp","11111111-1111-4111-8111-111111111111");const names=Object.keys(config.tools.configs).filter(name=>name.startsWith('gmail.'));assert.equal(names.length,6);assert.ok(names.includes('gmail.GMAIL_FETCH_EMAILS'));assert.ok(!names.some(name=>/SEND|DELETE|MODIFY|DRAFT/.test(name)));assert.equal(config.tools.default_config.permission,'deny');});
