import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq,inArray} from "drizzle-orm";
import {cases,crewRuns,caseAuthorities,caseAgentSetups} from "../backend/schema";
import {authorizeCase,readCaseAutonomy} from "../backend/autonomy-service";
import {pollCaseAgentSetups} from "../backend/case-agent-setup";
import {pollAutonomousCases} from "../backend/autonomy-runner";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Disposable branch required");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:4}),db=drizzle(pool),ids:string[]=[],owner=randomUUID();
process.env.CREW_ALLOWED_USER_IDS=owner;process.env.NAIVE_CASE_PROVISIONING_ENABLED="true";
const policy={synthetic:true,goal:"Review fictional claim evidence",contacts:[],max_decisions:3,max_outbound:0,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+86400000).toISOString()};
before(async()=>{await migrate(db,{migrationsFolder:"drizzle"});});
after(async()=>{if(ids.length){await db.delete(caseAuthorities).where(inArray(caseAuthorities.case_id,ids));await db.delete(cases).where(inArray(cases.id,ids));}await pool.end();});
async function fixture(review=true){
 // Stop earlier test jobs without changing their grants.
 if(ids.length)await db.update(caseAgentSetups).set({state:"stopped"}).where(inArray(caseAgentSetups.case_id,ids));
 const [item]=await db.insert(cases).values({owner_id:owner,title:"Synthetic setup queue"}).returning();ids.push(item.id);
 if(review)await db.insert(crewRuns).values({case_id:item.id,message:"{}",completed_at:new Date(),snapshot:{status:"idle",stop_reason:"end_turn",consumed_micro_usd:1,result:null,output_valid:true,approval_required:false}});
 return item;
}
const authorize=(id:string)=>authorizeCase(db,id,owner,policy,()=>true,true);
test("persistent authorization atomically queues setup and excludes legacy inference",async()=>{
 const item=await fixture(),authority=await authorize(item.id);
 const state=await readCaseAutonomy(db,item.id,owner);assert.equal(state.setups.length,1);assert.equal(state.setups[0].authority_id,authority.id);assert.equal(state.setups[0].state,"queued");
 const result=await pollAutonomousCases(db,{start:async()=>{throw Error("Legacy inference must not start");},read:async()=>{throw Error("Must not read");},send:async()=>{throw Error("Must not send");},allowed:()=>false});assert.equal(result.checked,0);
 await assert.rejects(()=>authorize(item.id),/AUTHORITY_ALREADY_EXISTS/);
});
test("disabled setup, missing review, and wrong owner cannot create a setup job",async()=>{
 const item=await fixture(false);
 process.env.NAIVE_CASE_PROVISIONING_ENABLED="false";await assert.rejects(()=>authorize(item.id),/PERSISTENT_SETUP_UNAVAILABLE/);process.env.NAIVE_CASE_PROVISIONING_ENABLED="true";
 await assert.rejects(()=>authorize(item.id),/REVIEW_REQUIRED/);
 await assert.rejects(()=>authorizeCase(db,item.id,"other",policy,()=>true,true),/NOT_FOUND/);
 assert.equal((await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.case_id,item.id))).length,0);
});
test("concurrent workers provision once with the existing authority and owner",async()=>{
 const item=await fixture(),authority=await authorize(item.id);let calls=0;
 const deps={provision:async(input:any)=>{calls++;assert.equal(input.caseId,item.id);assert.equal(input.authorityId,authority.id);assert.equal(input.owner,owner);}};
 await Promise.all([pollCaseAgentSetups(db,deps),pollCaseAgentSetups(db,deps)]);assert.equal(calls,1);
 const [job]=await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.case_id,item.id));assert.equal(job.state,"ready");assert.equal(job.lease_id,null);
 const [grant]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,authority.id));assert.equal(grant.decisions_used,0);assert.equal(grant.outbound_used,0);
});
test("provider failure backs off the same setup without replacing the grant",async()=>{
 const item=await fixture(),authority=await authorize(item.id);let calls=0;
 const deps={provision:async(input:any)=>{calls++;assert.equal(input.authorityId,authority.id);throw Error("Capacity");}};
 assert.equal((await pollCaseAgentSetups(db,deps)).failed,1);assert.equal((await pollCaseAgentSetups(db,deps)).checked,0);assert.equal(calls,1);
 const [job]=await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.case_id,item.id));assert.equal(job.state,"queued");assert.ok(job.next_check_at>new Date());assert.equal(job.lease_id,null);
 await db.update(caseAgentSetups).set({next_check_at:new Date(0)}).where(eq(caseAgentSetups.id,job.id));
 await pollCaseAgentSetups(db,{provision:async input=>{calls++;assert.equal(input.authorityId,authority.id);}});assert.equal(calls,2);
 assert.equal((await db.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,item.id))).length,1);
});
for(const change of ["revoke","owner","operator"]){test(`${change} change stops queued setup before provider work`,async()=>{
 const item=await fixture(),authority=await authorize(item.id);
 try{
  if(change==="revoke")await db.update(caseAuthorities).set({state:"revoked"}).where(eq(caseAuthorities.id,authority.id));
  if(change==="owner")await db.update(cases).set({owner_id:randomUUID()}).where(eq(cases.id,item.id));
  if(change==="operator")process.env.CREW_ALLOWED_USER_IDS="";
  const r=await pollCaseAgentSetups(db,{provision:async()=>{throw Error("Must not provision");}});assert.equal(r.failed,0);
  const [job]=await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.case_id,item.id));assert.equal(job.state,"stopped");
 }finally{process.env.CREW_ALLOWED_USER_IDS=owner;}
});}

test("capacity rejection defers setup until the shared provider cooldown without replacing its authority",async()=>{
 const item=await fixture(),authority=await authorize(item.id),retryAt=new Date(Date.now()+3600000);
 await db.execute((await import('drizzle-orm')).sql`INSERT INTO advocacy_naive_capacity(id,next_allowed_at) VALUES ('naive',${retryAt.toISOString()}) ON CONFLICT(id) DO UPDATE SET next_allowed_at=excluded.next_allowed_at,lease_until=NULL`);
 const result=await pollCaseAgentSetups(db,{provision:async()=>{throw Object.assign(Error("at capacity"),{status:429});}});
 assert.equal(result.failed,0);assert.equal(result.deferred,1);
 const [job]=await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.authority_id,authority.id));
 assert.equal(job.state,"queued");assert.equal(job.next_check_at.getTime(),retryAt.getTime());assert.equal(job.lease_id,null);
});
