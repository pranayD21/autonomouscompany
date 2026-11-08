import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq,inArray} from "drizzle-orm";
import {cases,caseAuthorities,caseDecisions,outreachActions,replyMonitors} from "../backend/schema";
import {takeCaseAction} from "../backend/case-action-service";
import {advanceCaseAuthority,type AutonomyDependencies} from "../backend/autonomy-runner";
import type {CaseAuthority,CaseDecision} from "../backend/autonomy-policy";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Disposable branch required");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:5}),db=drizzle(pool),ids:string[]=[],owner=randomUUID();
const policy:CaseAuthority={synthetic:true,goal:"Collect fictional employer details",contacts:[{id:"customer",role:"customer",channel:"email",destination:"demo@example.com"}],max_decisions:3,max_outbound:2,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+86400000).toISOString()};
const decision:CaseDecision={tool:"contact_customer",contact_id:"customer",subject:"Synthetic test",body:"Which fictional employer?",reason:"Employer missing",evidence_refs:["case:1"]};
const deps:AutonomyDependencies={allowed:()=>true,start:async()=>{throw Error("Unexpected inference");},read:async()=>{throw Error("Unexpected inference");},send:async a=>({provider_id:`msg-${a.id}`,provider_thread_id:`thread-${a.id}`,provider_status:"accepted"})};
before(async()=>{await migrate(db,{migrationsFolder:"drizzle"});});
after(async()=>{if(ids.length){const grants=await db.select().from(caseAuthorities).where(inArray(caseAuthorities.case_id,ids));const actions=await db.select().from(outreachActions).where(inArray(outreachActions.case_id,ids));if(actions.length)await db.delete(replyMonitors).where(inArray(replyMonitors.action_id,actions.map(a=>a.id)));if(grants.length)await db.delete(caseDecisions).where(inArray(caseDecisions.authority_id,grants.map(g=>g.id)));await db.delete(caseAuthorities).where(inArray(caseAuthorities.case_id,ids));await db.delete(outreachActions).where(inArray(outreachActions.case_id,ids));await db.delete(cases).where(inArray(cases.id,ids));}await pool.end();});
async function fixture(){const [item]=await db.insert(cases).values({owner_id:owner,title:"Synthetic native action"}).returning();ids.push(item.id);const [authority]=await db.insert(caseAuthorities).values({case_id:item.id,approved_by:owner,policy}).returning();return{item,authority,identity:{id:randomUUID(),case_id:item.id,owner_id:owner},input:{operation_id:randomUUID(),authority_id:authority.id,decision,channel:"email" as const}};}
test("concurrent native retries dispatch once and consume one decision and outbound slot",async()=>{
 const f=await fixture();let sends=0;const d={...deps,send:async(...args:Parameters<AutonomyDependencies["send"]>)=>{sends++;return deps.send(...args);}};
 await Promise.all([takeCaseAction(db,f.identity,f.input,d),takeCaseAction(db,f.identity,f.input,d),takeCaseAction(db,f.identity,f.input,d)]);
 const result=await takeCaseAction(db,f.identity,f.input,d);assert.equal(sends,1);assert.equal(result.action?.state,"submitted");assert.equal(result.state,"finished");
 const [a]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,f.authority.id));assert.equal(a.decisions_used,1);assert.equal(a.outbound_used,1);assert.equal(a.state,"waiting");assert.equal(a.lease_id,null);
 await assert.rejects(()=>takeCaseAction(db,f.identity,{...f.input,decision:{...decision,reason:"Changed request"}},d),/OPERATION_CONFLICT/);
});
test("owner, case, and contact channel isolation reject before dispatch",async()=>{
 const f=await fixture();await assert.rejects(()=>takeCaseAction(db,{...f.identity,owner_id:"other"},f.input,deps),/NOT_FOUND/);await assert.rejects(()=>takeCaseAction(db,{...f.identity,case_id:randomUUID()},f.input,deps),/NOT_FOUND/);await assert.rejects(()=>takeCaseAction(db,f.identity,{...f.input,channel:"call"},deps),/CHANNEL_MISMATCH/);
});
test("revoked authority, exhausted decisions, and an active lease deny new actions",async()=>{
 for(const patch of [{state:"revoked" as const},{decisions_used:3},{lease_id:randomUUID(),lease_until:new Date(Date.now()+60000)}]){const f=await fixture();await db.update(caseAuthorities).set(patch).where(eq(caseAuthorities.id,f.authority.id));await assert.rejects(()=>takeCaseAction(db,f.identity,f.input,deps));assert.equal((await db.select().from(outreachActions).where(eq(outreachActions.case_id,f.item.id))).length,0);}
});
test("uncertain provider results remain uncertain and never redial on retry",async()=>{
 const f=await fixture();let sends=0;const d={...deps,send:async()=>{sends++;throw Error("Timeout after possible acceptance");}};
 const first=await takeCaseAction(db,f.identity,f.input,d);assert.equal(first.action?.state,"unknown");await takeCaseAction(db,f.identity,f.input,d);assert.equal(sends,1);
});
test("scheduler recovers a reserved native decision without starting a model",async()=>{
 const f=await fixture();const choice:CaseDecision={tool:"wait_for_reply",minutes:10,reason:"Await fictional response",evidence_refs:["case:1"]};
 await db.insert(caseDecisions).values({id:f.input.operation_id,authority_id:f.authority.id,round:1,case_revision:1,state:"running",decision:choice,input:{native_tool:true,evidence_refs:["case:1"],customer_requested_stop:false}});
 await db.update(caseAuthorities).set({decisions_used:1}).where(eq(caseAuthorities.id,f.authority.id));await advanceCaseAuthority(db,f.authority.id,deps);
 const [round]=await db.select().from(caseDecisions).where(eq(caseDecisions.id,f.input.operation_id));assert.equal(round.state,"finished");assert.equal(round.session_id,null);
});
