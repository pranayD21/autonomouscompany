import {recordFirmTestFee} from '../backend/firm-finance';
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
after(async()=>{await pool.query('DELETE FROM advocacy_firm_records WHERE case_id=$1',[caseId]);const grants=await db.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,caseId));for(const grant of grants)await db.delete(caseDecisions).where(eq(caseDecisions.authority_id,grant.id));await db.delete(caseAuthorities).where(eq(caseAuthorities.case_id,caseId));await db.delete(caseOutcomes).where(eq(caseOutcomes.case_id,caseId));await db.delete(documentExtractions).where(eq(documentExtractions.document_id,docId));await db.delete(documents).where(eq(documents.id,docId));await db.delete(caseToolCredentials).where(eq(caseToolCredentials.case_id,caseId));await db.delete(cases).where(eq(cases.id,caseId));await pool.end();});

test('test fee verifies latest current evidence and reserves one intent per outcome across operations',async()=>{
 process.env.STRIPE_TEST_SECRET_KEY='rk_test_fixture';const outcome=await recordCaseOutcome(db,identity,input);let calls=0;
 const raw={operation_id:randomUUID(),case_id:caseId,outcome_id:outcome.id,fee_rate:.01,reason:'One percent of the reported supported reduction.'};
 const fake=(async()=>{calls++;return Response.json({id:'pi_fixture',object:'payment_intent',livemode:false,amount:800,currency:'usd',amount_received:0,status:'requires_payment_method',client_secret:'never-retain'});}) as typeof fetch;
 const first=await recordFirmTestFee(db,raw,fake),again=await recordFirmTestFee(db,{...raw,operation_id:randomUUID()},fake);assert.equal(calls,1);assert.equal(first.state,'test_intent_created');assert.equal(first.paid,false);assert.equal(again.provider_id,'pi_fixture');assert.equal(JSON.stringify(first).includes('never-retain'),false);
 await assert.rejects(recordFirmTestFee(db,{...raw,fee_rate:.02},fake),/TEST_FEE_CONFLICT/);
 const newer=await recordCaseOutcome(db,identity,{...input,operation_id:randomUUID()});
 await db.update(documentExtractions).set({confirmed_at:null}).where(eq(documentExtractions.document_id,docId));
 await assert.rejects(recordFirmTestFee(db,{...raw,operation_id:randomUUID(),outcome_id:newer.id},fake),/OUTCOME_EVIDENCE_MISMATCH/);assert.equal(calls,1);
 await db.update(documentExtractions).set({confirmed_at:new Date()}).where(eq(documentExtractions.document_id,docId));
 const unknown={...raw,operation_id:randomUUID(),outcome_id:newer.id};await assert.rejects(recordFirmTestFee(db,unknown,(async()=>{calls++;throw Error('timeout');}) as typeof fetch),/timeout/);
 const retry=await recordFirmTestFee(db,{...unknown,operation_id:randomUUID()},fake);assert.equal(retry.state,'unknown');assert.equal(calls,2);
});
