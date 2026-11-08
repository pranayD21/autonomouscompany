import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq,inArray,sql} from "drizzle-orm";
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
 }finally{process.env.CREW_ALLOWED_USER_IDS=owner;delete process.env.NAIVE_OPEN_COORDINATOR_ID;delete process.env.NAIVE_OPEN_GENERAL_AGENT_VERSION;}
});}

test("capacity rejection defers setup until the shared provider cooldown without replacing its authority",async()=>{
 const item=await fixture(),authority=await authorize(item.id),retryAt=new Date(Date.now()+3600000);
 await db.execute((await import('drizzle-orm')).sql`INSERT INTO advocacy_naive_capacity(id,next_allowed_at) VALUES ('naive',${retryAt.toISOString()}) ON CONFLICT(id) DO UPDATE SET next_allowed_at=excluded.next_allowed_at,lease_until=NULL`);
 const result=await pollCaseAgentSetups(db,{provision:async()=>{throw Object.assign(Error("at capacity"),{status:429});}});
 assert.equal(result.failed,0);assert.equal(result.deferred,1);
 const [job]=await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.authority_id,authority.id));
 assert.equal(job.state,"queued");assert.equal(job.next_check_at.getTime(),retryAt.getTime());assert.equal(job.lease_id,null);
});

test("v2 setup permits a normal owner and parks unchanged permission while human input is required",async()=>{
 const item=await fixture(false);
 const result=await db.execute(sql`INSERT INTO advocacy_case_authorities(case_id,approved_by,policy,state) VALUES(${item.id},${owner},${JSON.stringify({version:2,consent:"Handle this fictional case."})}::jsonb,'human_required') RETURNING id`);
 const authorityId=result.rows[0].id as string;
 const [job]=await db.insert(caseAgentSetups).values({case_id:item.id,authority_id:authorityId,requested_by:owner}).returning();
 let provisions=0;process.env.CREW_ALLOWED_USER_IDS="";
 try{
  process.env.NAIVE_OPEN_COORDINATOR_ID="agt_open_fixture";process.env.NAIVE_OPEN_GENERAL_AGENT_VERSION="3";
  const deps={provision:async(input:any)=>{assert.equal(input.agentId,"agt_open_fixture");assert.equal(input.generalVersion,3);provisions++;}};
  await pollCaseAgentSetups(db,deps);assert.equal(provisions,0);
  assert.equal((await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.id,job.id)))[0].state,"queued");
  await db.update(caseAuthorities).set({state:"active"}).where(eq(caseAuthorities.id,authorityId));
  await db.update(caseAgentSetups).set({next_check_at:new Date(0)}).where(eq(caseAgentSetups.id,job.id));
  await pollCaseAgentSetups(db,deps);assert.equal(provisions,1);
  assert.equal((await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.id,job.id)))[0].state,"ready");
 }finally{process.env.CREW_ALLOWED_USER_IDS=owner;delete process.env.NAIVE_OPEN_COORDINATOR_ID;delete process.env.NAIVE_OPEN_GENERAL_AGENT_VERSION;}
});

test('firm provisioning retries the hired agent and CEO budget without using the shared coordinator',async()=>{
 const item=await fixture(false);
 const authorityId=randomUUID(),agentId=`agt_case_${randomUUID()}`;
 await pool.query("INSERT INTO advocacy_case_authorities(id,case_id,approved_by,policy) VALUES($1,$2,$3,$4)",[authorityId,item.id,owner,JSON.stringify({version:2,consent:'Authorize firm staffing for this fictional case.'})]);
 const [job]=await db.insert(caseAgentSetups).values({case_id:item.id,authority_id:authorityId,requested_by:owner}).returning();
 await pool.query("INSERT INTO advocacy_firm_staffing(case_id,authority_id,state,agent_id,budget_micro_usd) VALUES($1,$2,'hiring',$3,50000)",[item.id,authorityId,agentId]);
 const key=`advocate-provision:${authorityId}`;
 await pool.query("INSERT INTO advocacy_firm_records(key,kind,actor,case_id,payload) VALUES($1,'advocate_provisioning','frontdesk',$2,$3)",[key,item.id,JSON.stringify({authority_id:authorityId,agent_id:agentId,general_version:7,state:'queued'})]);
 const inputs:any[]=[];
 const first=await pollCaseAgentSetups(db,{provision:async input=>{inputs.push(input);throw Object.assign(Error('Admission rejected'),{status:429});}});
 assert.equal(first.deferred,1);assert.equal((await pool.query('SELECT state FROM advocacy_firm_staffing WHERE case_id=$1',[item.id])).rows[0].state,'hiring');
 await db.update(caseAgentSetups).set({next_check_at:new Date(0)}).where(eq(caseAgentSetups.id,job.id));
 await Promise.all([pollCaseAgentSetups(db,{provision:async input=>{inputs.push(input);}}),pollCaseAgentSetups(db,{provision:async input=>{inputs.push(input);}})]);
 assert.equal(inputs.length,2);assert.deepEqual(inputs[0],inputs[1]);assert.equal(inputs[1].agentId,agentId);assert.equal(inputs[1].generalVersion,7);assert.equal(inputs[1].budgetMicroUsd,50000);
 assert.equal((await pool.query('SELECT state FROM advocacy_firm_staffing WHERE case_id=$1',[item.id])).rows[0].state,'active');
 assert.equal((await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.id,job.id)))[0].state,'ready');
 assert.equal((await pool.query('SELECT payload FROM advocacy_firm_records WHERE key=$1',[key])).rows[0].payload.state,'ready');
});
