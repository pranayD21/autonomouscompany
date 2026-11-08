import {takeCaseAction} from "../backend/case-action-service";
import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq} from "drizzle-orm";
import {cases,documents,documentExtractions,caseToolCredentials,caseOutcomes,caseAuthorities,caseDecisions} from "../backend/schema";
import {issueCaseToolCredential} from "../backend/case-tool-auth";
import {recordCaseOutcome,readCaseOutcomes,type OutcomeInput} from "../backend/case-outcome";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Disposable branch required");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:3}),db=drizzle(pool),caseId=randomUUID(),docId=randomUUID(),owner=randomUUID();
let identity:{id:string;case_id:string;owner_id:string};
const quote="Synthetic final statement: original responsibility $1000; final responsibility $200. Refund pending.";
const input:OutcomeInput={operation_id:randomUUID(),summary:"Fictional balance reduction; refund not received.",claim_decision:"partially_accepted",currency:"USD",original_responsibility_cents:100000,final_responsibility_cents:20000,reduction_cents:80000,refund_received_cents:null,calculation_explanation:"100000 - 20000 = 80000 cents; a pending refund is not received cash.",evidence:[{source_ref:`document:${docId}:${"a".repeat(64)}`,quote}]};
before(async()=>{
 await migrate(db,{migrationsFolder:"drizzle"});await db.insert(cases).values({id:caseId,owner_id:owner,title:"Synthetic outcome"});
 const credential=await issueCaseToolCredential(db,caseId,owner);identity={id:credential.id,case_id:caseId,owner_id:owner};
 await db.insert(documents).values({id:docId,case_id:caseId,object_key:`test/${docId}`,filename:"fictional.txt",mime:"text/plain",byte_size:quote.length,sha256:"a".repeat(64),kind:"bill",state:"ready"});
 await db.insert(documentExtractions).values({document_id:docId,state:"ready",confirmed_at:new Date(),result:{visible_text:quote,insurer_name:null,member_name:null,member_id:null,group_number:null,claim_number:null,uncertainties:[]}});
});
after(async()=>{const grants=await db.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,caseId));for(const grant of grants)await db.delete(caseDecisions).where(eq(caseDecisions.authority_id,grant.id));await db.delete(caseAuthorities).where(eq(caseAuthorities.case_id,caseId));await db.delete(caseOutcomes).where(eq(caseOutcomes.case_id,caseId));await db.delete(documentExtractions).where(eq(documentExtractions.document_id,docId));await db.delete(documents).where(eq(documents.id,docId));await db.delete(caseToolCredentials).where(eq(caseToolCredentials.case_id,caseId));await db.delete(cases).where(eq(cases.id,caseId));await pool.end();});
test("concurrent retries preserve one agent-calculated report and one revision increment",async()=>{
 const [a,b]=await Promise.all([recordCaseOutcome(db,identity,input),recordCaseOutcome(db,identity,input)]);assert.equal(a.id,b.id);assert.equal(a.report.refund_received_cents,null);assert.equal(a.report.reduction_cents,80000);
 assert.equal((await db.select().from(cases).where(eq(cases.id,caseId)))[0].revision,2);
 const [read]=await readCaseOutcomes(db,caseId);assert.equal(read.attribution,"agent_reported");assert.equal(read.evidence_current,true);assert.equal(read.independently_verified,false);
});
test("changed retries and other owners cannot alter the saved outcome",async()=>{
 await assert.rejects(()=>recordCaseOutcome(db,identity,{...input,reduction_cents:99999}),/OPERATION_CONFLICT/);
 await assert.rejects(()=>recordCaseOutcome(db,{...identity,owner_id:"other"},input),/NOT_FOUND/);
});
test("recorded synthetic outcome can stop its authorized scenario without claiming real success or sending",async()=>{
 const [outcome]=await readCaseOutcomes(db,caseId);
 const [authority]=await db.insert(caseAuthorities).values({case_id:caseId,approved_by:owner,policy:{synthetic:true,goal:"Resolve the fictional billing scenario",contacts:[{id:"customer",role:"customer",channel:"email",destination:"demo@example.com"}],max_decisions:3,max_outbound:2,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+86400000).toISOString()}}).returning();
 const request={operation_id:randomUUID(),authority_id:authority.id,decision:{tool:"stop_case" as const,outcome:"synthetic_demo_completed" as const,summary:"Fictional result recorded.",reason:"The scenario has an evidence-linked result",evidence_refs:[`outcome:${outcome.id}`]}};
 const deps={allowed:()=>false,start:async()=>{throw Error("No inference");},read:async()=>{throw Error("No inference");},send:async()=>{throw Error("No outreach");}};
 const result=await takeCaseAction(db,identity,request,deps);assert.equal(result.state,"finished");
 const [saved]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,authority.id));assert.equal(saved.state,"stopped");assert.match(saved.reason!,/no real payout verified/);assert.equal(saved.outbound_used,0);
 const repeat=await takeCaseAction(db,identity,request,deps);assert.equal(repeat.operation_id,result.operation_id);
});
test("invented quotes, foreign references, and unconfirmed documents cannot support new outcomes",async()=>{
 for(const evidence of [[{...input.evidence[0],quote:"Invented successful payout"}],[{...input.evidence[0],source_ref:`document:${randomUUID()}:${"a".repeat(64)}`}]] )await assert.rejects(()=>recordCaseOutcome(db,identity,{...input,operation_id:randomUUID(),evidence}),/EVIDENCE_MISMATCH/);
 await db.update(documentExtractions).set({confirmed_at:null}).where(eq(documentExtractions.document_id,docId));
 await assert.rejects(()=>recordCaseOutcome(db,identity,{...input,operation_id:randomUUID()}),/EVIDENCE_MISMATCH/);
 const [read]=await readCaseOutcomes(db,caseId);assert.equal(read.evidence_current,false);assert.equal(read.report.refund_received_cents,null);
});
