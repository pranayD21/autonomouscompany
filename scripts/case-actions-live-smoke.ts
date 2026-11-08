import {config} from "dotenv";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq} from "drizzle-orm";
import assert from "node:assert/strict";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {cases,caseAuthorities,caseDecisions,caseToolCredentials,outreachActions} from "../backend/schema";
import {issueCaseToolCredential} from "../backend/case-tool-auth";
config({path:[".env.local",".env"],quiet:true});
const owner=process.env.CREW_ALLOWED_USER_IDS?.split(",")[0],endpoint=process.env.NAIVE_CASE_TOOLS_URL;if(!owner||!endpoint)throw Error("Operator and MCP endpoint required");
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:2}),db=drizzle(pool),caseId=randomUUID(),authorityId=randomUUID();
const client=new Client({name:"Assurance action smoke",version:"1"});
try{
 await db.insert(cases).values({id:caseId,owner_id:owner,title:"Temporary synthetic human-help test"});
 await db.insert(caseAuthorities).values({id:authorityId,case_id:caseId,approved_by:owner,next_wake_at:new Date(Date.now()+86400000),policy:{synthetic:true,goal:"Verify the internal human-help transition only",contacts:[{id:"fictional",role:"customer",channel:"email",destination:"fictional@example.invalid"}],max_decisions:2,max_outbound:1,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+3600000).toISOString()}});
 const credential=await issueCaseToolCredential(db,caseId,owner);await client.connect(new StreamableHTTPClientTransport(new URL(endpoint),{requestInit:{headers:{Authorization:`Bearer ${credential.token}`}}}));
 const names=(await client.listTools()).tools.map(t=>t.name);for(const name of ["send_email","place_call","schedule_followup","request_human","stop_case"])assert.ok(names.includes(name));
 const args={case_id:caseId,authority_id:authorityId,operation_id:randomUUID(),reason:"Synthetic integration test requires an operator",evidence_refs:["case:1"],question:"Please review this fictional test case."};
 const first=await client.callTool({name:"request_human",arguments:args});assert.notEqual(first.isError,true);const retry=await client.callTool({name:"request_human",arguments:args});assert.deepEqual(first.content,retry.content);
 const [a]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,authorityId));assert.equal(a.state,"human_required");assert.equal(a.decisions_used,1);assert.equal(a.outbound_used,0);
 const denied=await client.callTool({name:"send_email",arguments:{case_id:caseId,authority_id:authorityId,reason:args.reason,evidence_refs:args.evidence_refs,operation_id:randomUUID(),contact_id:"fictional",role:"customer",subject:"Synthetic",body:"This must not send."}});assert.equal(denied.isError,true);
 assert.equal((await db.select().from(outreachActions).where(eq(outreachActions.case_id,caseId))).length,0);
 console.log("PASS live MCP actions: tool discovery, human-help transition, idempotent retry, inactive-authority send rejection, zero outbound records.");
}finally{
 await client.close();await db.delete(caseDecisions).where(eq(caseDecisions.authority_id,authorityId));await db.delete(caseAuthorities).where(eq(caseAuthorities.id,authorityId));await db.delete(caseToolCredentials).where(eq(caseToolCredentials.case_id,caseId));await db.delete(cases).where(eq(cases.id,caseId));await pool.end();
}
