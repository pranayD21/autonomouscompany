import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq,inArray,sql} from "drizzle-orm";
import {cases,crewRuns} from "../backend/schema";
import {pollCrewReviews} from "../backend/crew-monitor";
import {saveCrewCompletion,type CrewSession} from "../backend/crew-completion";

if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Use an isolated Neon branch");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:5,connectionTimeoutMillis:15000,query_timeout:30000});const db=drizzle(pool);
// The test branch is a disposable copy; prevent copied runs from entering fixture checks.
await db.update(crewRuns).set({poll_after:null});
const caseIds:string[]=[];
const output={summary:"Synthetic unverified difference",potential_discrepancy_cents:80000,evidence:["bill_amount"],missing_information:["EOB"],next_actions:["Request fictional EOB"],human_help_required:true,human_help_reason:"Missing evidence"};
const valid:CrewSession={status:"idle",stop_reason:"end_turn",consumed_micro_usd:10,structured_output:output,pending_actions:[]};
async function fixture(message:unknown={case:{bill_cents:120000,eob_cents:40000}}){
 const [item]=await db.insert(cases).values({owner_id:`crew-monitor-${randomUUID()}`,title:"Synthetic crew check",bill_cents:120000,eob_cents:40000}).returning();caseIds.push(item.id);
 const [run]=await db.insert(crewRuns).values({case_id:item.id,message:JSON.stringify(message),session_id:`fixture-${randomUUID()}`}).returning();return run;
}
const get=async(id:string)=>(await db.select().from(crewRuns).where(eq(crewRuns.id,id)))[0];
after(async()=>{if(caseIds.length)await db.delete(cases).where(inArray(cases.id,caseIds));await pool.end();});

test("overlapping deliveries read once and save against captured facts after case edits",async()=>{
 const run=await fixture();await db.update(cases).set({bill_cents:null,eob_cents:null,revision:2}).where(eq(cases.id,run.case_id));let reads=0;
 const results=await Promise.all(Array.from({length:4},(_,i)=>pollCrewReviews(db,`concurrent-${i}`,async id=>{assert.equal(id,run.session_id);reads++;await new Promise(r=>setTimeout(r,100));return valid;})));
 assert.equal(reads,1);assert.equal(results.reduce((n,x)=>n+x.saved,0),1);const saved=await get(run.id);
 assert.ok(saved.completed_at);assert.equal(saved.snapshot?.result?.potential_discrepancy_cents,80000);assert.equal(saved.poll_after,null);assert.equal(saved.poll_lease_id,null);
 assert.equal((await pollCrewReviews(db,"repeat",async()=>{throw Error("Must not read saved runs");})).checked,0);
 // A simultaneous stale read cannot replace the first accepted result.
 const result=await saveCrewCompletion(db,run,{...valid,structured_output:{...output,summary:"Late result"}});
 assert.equal(result.result?.summary,output.summary);
});
test("invalid references and pending approvals are not published and stop automatic checks",async()=>{
 for(const session of [{...valid,status:"failed"},{...valid,status:"cancelled"},{...valid,pending_actions:[{id:"approval"}]},{...valid,structured_output:{...output,document_references:[{document_id:randomUUID(),sha256:"a".repeat(64)}]}}]){
  const run=await fixture();const result=await pollCrewReviews(db,"held",async()=>session);assert.equal(result.needs_attention,1);
  const saved=await get(run.id);assert.equal(saved.completed_at,null);assert.equal(saved.snapshot,null);assert.equal(saved.poll_status,"needs_attention");assert.equal(saved.poll_after,null);
 }
});
test("provider failure retries later; active delegation remains pending",async()=>{
 const run=await fixture();assert.equal((await pollCrewReviews(db,"failure",async()=>{throw Error("Private credentials must not persist");})).failed,1);
 let saved=await get(run.id);assert.equal(saved.poll_status,"check_failed");assert.equal(saved.completed_at,null);assert.ok(saved.poll_after!.getTime()>Date.now()+14*60000);
 await db.update(crewRuns).set({poll_after:sql`now()`}).where(eq(crewRuns.id,run.id));
 await pollCrewReviews(db,"pending",async()=>({...valid,stop_reason:"awaiting_delegation"}));saved=await get(run.id);assert.equal(saved.poll_status,"pending");assert.ok(saved.poll_after!.getTime()>Date.now()+4*60000);assert.equal(saved.completed_at,null);
 await db.update(crewRuns).set({poll_after:null}).where(eq(crewRuns.id,run.id));
});
test("expired leases recover; active leases and missing sessions are skipped",async()=>{
 const run=await fixture(),noSession=await fixture();await db.update(crewRuns).set({session_id:null}).where(eq(crewRuns.id,noSession.id));
 await db.update(crewRuns).set({poll_lease_id:randomUUID(),poll_lease_until:sql`now()+interval '10 minutes'`}).where(eq(crewRuns.id,run.id));
 assert.equal((await pollCrewReviews(db,"skip",async()=>valid)).checked,0);
 await db.update(crewRuns).set({poll_lease_until:sql`now()-interval '1 second'`}).where(eq(crewRuns.id,run.id));assert.equal((await pollCrewReviews(db,"recover",async()=>valid)).saved,1);
});
test("a correction submitted during a read preserves its new check schedule",async()=>{
 for(const fail of [false,true]){
 const run=await fixture();await pollCrewReviews(db,"repair-race",async()=>{
  await db.update(crewRuns).set({repair_sent_at:new Date(),poll_after:sql`now()+interval '1 minute'`,poll_status:"pending"}).where(eq(crewRuns.id,run.id));
  if(fail)throw Error("Provider read failed while repair was submitted");
  return {...valid,structured_output:null};
 });const saved=await get(run.id);assert.equal(saved.poll_status,"pending");assert.ok(saved.poll_after);assert.equal(saved.poll_lease_id,null);
 await db.update(crewRuns).set({poll_after:null}).where(eq(crewRuns.id,run.id));
 }
});
test("one delivery reads at most five due sessions",async()=>{
 for(let n=0;n<6;n++)await fixture();assert.equal((await pollCrewReviews(db,"batch",async()=>valid)).saved,5);assert.equal((await pollCrewReviews(db,"remaining",async()=>valid)).saved,1);
});
