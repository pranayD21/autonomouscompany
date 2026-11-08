import {config} from "dotenv";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq} from "drizzle-orm";
import assert from "node:assert/strict";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {cases,caseOutcomes,documents,documentExtractions,caseToolCredentials} from "../backend/schema";
import {issueCaseToolCredential} from "../backend/case-tool-auth";
config({path:[".env.local",".env"],quiet:true});
const owner=process.env.CREW_ALLOWED_USER_IDS?.split(",")[0],endpoint=process.env.NAIVE_CASE_TOOLS_URL;
if(!owner||!endpoint)throw Error("Configured operator and MCP endpoint required");
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:2}),db=drizzle(pool),caseId=randomUUID(),docId=randomUUID();
const client=new Client({name:"Assurance outcome smoke",version:"1"});
try{
 await db.insert(cases).values({id:caseId,owner_id:owner,title:"Temporary synthetic outcome verification"});
 const credential=await issueCaseToolCredential(db,caseId,owner);
 await client.connect(new StreamableHTTPClientTransport(new URL(endpoint),{requestInit:{headers:{Authorization:`Bearer ${credential.token}`}}}));
 const quote="Fictional statement: original responsibility $1000; final responsibility $200. Refund pending.";
 await db.insert(documents).values({id:docId,case_id:caseId,object_key:`test/${docId}`,filename:"synthetic.txt",mime:"text/plain",byte_size:quote.length,sha256:"a".repeat(64),kind:"bill",state:"ready"});
 await db.insert(documentExtractions).values({document_id:docId,state:"ready",confirmed_at:new Date(),result:{visible_text:quote,insurer_name:null,member_name:null,member_id:null,group_number:null,claim_number:null,uncertainties:[]}});
 assert.ok((await client.listTools()).tools.some(t=>t.name==="record_outcome"));
 const args={case_id:caseId,operation_id:randomUUID(),summary:"Synthetic balance reduction",claim_decision:"partially_accepted",currency:"USD",original_responsibility_cents:100000,final_responsibility_cents:20000,reduction_cents:80000,refund_received_cents:null,calculation_explanation:"100000 - 20000 = 80000 cents; no refund received.",evidence:[{source_ref:`document:${docId}:${"a".repeat(64)}`,quote}]};
 const first=await client.callTool({name:"record_outcome",arguments:args});assert.notEqual(first.isError,true);
 const second=await client.callTool({name:"record_outcome",arguments:args});assert.notEqual(second.isError,true);assert.deepEqual(first.content,second.content);
 const cross=await client.callTool({name:"record_outcome",arguments:{...args,case_id:randomUUID()}});assert.equal(cross.isError,true);
 const read=await client.callTool({name:"case_get",arguments:{case_id:caseId}});const payload=JSON.parse((read.content as {text:string}[])[0].text);
 assert.equal(payload.outcomes.length,1);assert.equal(payload.outcomes[0].report.refund_received_cents,null);assert.equal(payload.outcomes[0].evidence_current,true);assert.equal(payload.outcomes[0].independently_verified,false);assert.equal(payload.case.revision,2);
 console.log("PASS live MCP outcome: discovery, exact evidence, separate refund/reduction, same-operation retry, case isolation, and persisted readback.");
}finally{
 await client.close();await db.delete(caseOutcomes).where(eq(caseOutcomes.case_id,caseId));await db.delete(documentExtractions).where(eq(documentExtractions.document_id,docId));await db.delete(documents).where(eq(documents.id,docId));await db.delete(caseToolCredentials).where(eq(caseToolCredentials.case_id,caseId));await db.delete(cases).where(eq(cases.id,caseId));await pool.end();
}
