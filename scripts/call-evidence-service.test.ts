import {test,after,before} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq,inArray} from "drizzle-orm";
import {cases,outreachActions,callEvidence,caseAuthorities} from "../backend/schema";
import {importCallEvidence,saveCallEvidence} from "../backend/call-evidence-service";
import {parseCallEvidence} from "../backend/providers/call-evidence";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Disposable branch required");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:4}),db=drizzle(pool);
const ids=[randomUUID(),randomUUID()],actionId=randomUUID(),owner=`call-test-${randomUUID()}`;
const evidence=parseCallEvidence("agentphone","test-call",{id:"test-call",status:"completed",transcripts:[{transcript:"Fictional claim under review",response:"Thank you"}]})!;
before(async()=>{await migrate(db,{migrationsFolder:"drizzle"});await db.insert(cases).values(ids.map(id=>({id,owner_id:owner,title:"Synthetic call evidence"})));await db.insert(outreachActions).values({id:actionId,case_id:ids[0],kind:"call",destination:"+12025550123",subject:"Synthetic",body:"Test",state:"submitted",provider_id:"test-call"});});
after(async()=>{await db.delete(callEvidence).where(inArray(callEvidence.case_id,ids));await db.delete(caseAuthorities).where(inArray(caseAuthorities.case_id,ids));await db.delete(outreachActions).where(inArray(outreachActions.case_id,ids));await db.delete(cases).where(inArray(cases.id,ids));await pool.end();});
test("concurrent transcript imports persist once and advance case once",async()=>{
 const [a,b]=await Promise.all([saveCallEvidence(db,ids[0],actionId,owner,evidence),saveCallEvidence(db,ids[0],actionId,owner,evidence)]);assert.equal(a.id,b.id);
 assert.equal((await db.select().from(callEvidence).where(eq(callEvidence.action_id,actionId))).length,1);assert.equal((await db.select().from(cases).where(eq(cases.id,ids[0])))[0].revision,2);
});
test("wrong owners/cases/receipts reject without reading or writing another case",async()=>{
 let reads=0;await assert.rejects(()=>importCallEvidence(db,ids[0],actionId,"wrong",async()=>{reads++;return evidence;}),/NOT_FOUND/);assert.equal(reads,0);
 await assert.rejects(()=>saveCallEvidence(db,ids[1],actionId,owner,evidence),/MISMATCH/);
 await assert.rejects(()=>saveCallEvidence(db,ids[0],actionId,owner,{...evidence,provider_id:"other"}),/MISMATCH/);
});

test("new evidence wakes only live authority without resetting action limits",async()=>{
 const live=randomUUID(),revoked=randomUUID();
 await db.insert(caseAuthorities).values([{id:live,case_id:ids[0],policy:{} as never,approved_by:owner,state:"waiting",next_wake_at:new Date(Date.now()+86400000),decisions_used:2,outbound_used:1},{id:revoked,case_id:ids[0],policy:{} as never,approved_by:owner,state:"revoked",next_wake_at:null}]);
 const updated=parseCallEvidence("agentphone","test-call",{id:"test-call",status:"completed",transcripts:[{transcript:"Updated fictional claim status"}]})!;
 await saveCallEvidence(db,ids[0],actionId,owner,updated);
 const rows=await db.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,ids[0]));
 const active=rows.find(r=>r.id===live)!;assert.equal(active.state,"waiting");assert.equal(active.decisions_used,2);assert.equal(active.outbound_used,1);assert.ok(active.next_wake_at!.getTime()<=Date.now());assert.equal(rows.find(r=>r.id===revoked)!.next_wake_at,null);
});
