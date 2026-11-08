import {config} from "dotenv";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq} from "drizzle-orm";
import assert from "node:assert/strict";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {cases,caseSources,caseToolCredentials} from "../backend/schema";
import {issueCaseToolCredential} from "../backend/case-tool-auth";
config({path:[".env.local",".env"],quiet:true});
const owner=process.env.CREW_ALLOWED_USER_IDS?.split(",")[0],endpoint=process.env.NAIVE_CASE_TOOLS_URL;
if(!owner||!endpoint)throw Error("Configured operator and MCP endpoint required");
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:2}),db=drizzle(pool),caseId=randomUUID();
const client=new Client({name:"Assurance citation smoke",version:"1"});
try{
 await db.insert(cases).values({id:caseId,owner_id:owner,title:"Temporary synthetic source verification"});
 const credential=await issueCaseToolCredential(db,caseId,owner);
 await client.connect(new StreamableHTTPClientTransport(new URL(endpoint),{requestInit:{headers:{Authorization:`Bearer ${credential.token}`}}}));
 assert.ok((await client.listTools()).tools.some(t=>t.name==="cite_source"));
 const args={case_id:caseId,operation_id:randomUUID(),url:"https://example.com/",quote:"This domain is for use in documentation examples without needing permission."};
 const first=await client.callTool({name:"cite_source",arguments:args});assert.notEqual(first.isError,true);
 const second=await client.callTool({name:"cite_source",arguments:args});assert.notEqual(second.isError,true);assert.deepEqual(first.content,second.content);
 const rows=await db.select().from(caseSources).where(eq(caseSources.case_id,caseId));assert.equal(rows.length,1);assert.equal(rows[0].quote,args.quote);
 assert.equal((await db.select().from(cases).where(eq(cases.id,caseId)))[0].revision,2);
 const read=await client.callTool({name:"case_get",arguments:{case_id:caseId}});assert.ok(JSON.stringify(read.content).includes(`source:${rows[0].id}:${rows[0].sha256}`));
 console.log("PASS live MCP citation: public HTTPS retrieval, exact quote, stored source/hash, idempotent retry, and case evidence reference.");
}finally{
 await client.close();await db.delete(caseSources).where(eq(caseSources.case_id,caseId));await db.delete(caseToolCredentials).where(eq(caseToolCredentials.case_id,caseId));await db.delete(cases).where(eq(cases.id,caseId));await pool.end();
}
