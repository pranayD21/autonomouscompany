import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq,inArray} from "drizzle-orm";
import {cases,caseAuthorities,caseToolCredentials,caseAgentSessions,caseAgentEvents} from "../backend/schema";
import {issueCaseToolCredential} from "../backend/case-tool-auth";
import {registerCaseAgentSession,pollCaseAgentSessions,advanceCaseAgentSession,type CaseSessionDependencies} from "../backend/case-agent-session";
import {queueCaseAgentEvent} from "../backend/case-agent-events";
import {pollAutonomousCases} from "../backend/autonomy-runner";
import type {CaseAuthority} from "../backend/autonomy-policy";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Disposable branch required");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:5}),db=drizzle(pool),ids:string[]=[],owner=randomUUID();process.env.CREW_ALLOWED_USER_IDS=owner;
const policy:CaseAuthority={synthetic:true,goal:"Gather fictional claim facts",contacts:[{id:"customer",role:"customer",channel:"email",destination:"demo@example.com"}],max_decisions:3,max_outbound:2,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+86400000).toISOString()};
const deps:CaseSessionDependencies={verifyBinding:async()=>true,start:async()=>({id:`ses_${randomUUID()}`}),read:async()=>({status:"idle",stop_reason:"end_turn",pending_actions:[]}),send:async()=>({accepted_seq:7}),cancel:async()=>({})};
before(async()=>{await migrate(db,{migrationsFolder:"drizzle"});});
after(async()=>{if(ids.length){const runs=await db.select().from(caseAgentSessions).where(inArray(caseAgentSessions.case_id,ids));if(runs.length)await db.delete(caseAgentEvents).where(inArray(caseAgentEvents.run_id,runs.map(r=>r.id)));await db.delete(caseAgentSessions).where(inArray(caseAgentSessions.case_id,ids));await db.delete(caseToolCredentials).where(inArray(caseToolCredentials.case_id,ids));await db.delete(caseAuthorities).where(inArray(caseAuthorities.case_id,ids));await db.delete(cases).where(inArray(cases.id,ids));}await pool.end();});
async function fixture(){const [item]=await db.insert(cases).values({owner_id:owner,title:"Synthetic persistent case"}).returning();ids.push(item.id);const [authority]=await db.insert(caseAuthorities).values({case_id:item.id,approved_by:owner,policy,next_wake_at:null}).returning();const credential=await issueCaseToolCredential(db,item.id,owner);const input={case_id:item.id,authority_id:authority.id,credential_id:credential.id,identity_id:`idn_${randomUUID()}`,agent_id:"agt_test",agent_version:18};const run=await registerCaseAgentSession(db,input,owner);return{item,authority,credential,input,run};}
const get=async(id:string)=>(await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.id,id)))[0];
test("binding is owner/case scoped and repeated setup does not create another session",async()=>{
 const f=await fixture();assert.equal((await registerCaseAgentSession(db,f.input,owner)).id,f.run.id);await assert.rejects(()=>registerCaseAgentSession(db,f.input,"other"),/INVALID_CASE_BINDING/);await assert.rejects(()=>registerCaseAgentSession(db,{...f.input,identity_id:"idn_other"},owner),/CONFLICT/);
});
test("concurrent scheduler ticks create one session with the approved cap and identity",async()=>{
 const f=await fixture();let starts=0;const d={...deps,start:async(input:Parameters<CaseSessionDependencies["start"]>[0],key:string)=>{starts++;assert.equal(input.budget_micro_usd,250000);assert.ok(input.identity);assert.ok(key.startsWith("case-session:"));return deps.start(input,key);}};
 // Park unrelated fixtures so the scheduler isolates this scenario.
 await db.update(caseAgentSessions).set({next_check_at:new Date(Date.now()+86400000)}).where(inArray(caseAgentSessions.case_id,ids.filter(id=>id!==f.item.id)));
 await Promise.all([pollCaseAgentSessions(db,d),pollCaseAgentSessions(db,d)]);assert.equal(starts,1);assert.ok((await get(f.run.id)).session_id);
 const legacy=await pollAutonomousCases(db,{start:async()=>{throw Error("Legacy model must not start");},read:async()=>{throw Error("Legacy model must not read");},send:async()=>{throw Error("Must not send");},allowed:()=>false});assert.equal(legacy.checked,0);
});
test("queued events are idempotent and resume the existing session",async()=>{
 const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);const id=(await get(f.run.id)).session_id!;
 await queueCaseAgentEvent(db,f.item.id,"reply:1","reply_received",{revision:2});await queueCaseAgentEvent(db,f.item.id,"reply:1","reply_received",{revision:2});
 let sends=0;await advanceCaseAgentSession(db,f.run.id,{...deps,send:async(session,message,key)=>{sends++;assert.equal(session,id);assert.match(message,/untrusted/);assert.ok(key.startsWith("case-event:"));return {accepted_seq:9};}});
 await advanceCaseAgentSession(db,f.run.id,deps);assert.equal(sends,1);const events=await db.select().from(caseAgentEvents).where(eq(caseAgentEvents.run_id,f.run.id));assert.equal(events.length,1);assert.equal(events[0].accepted_seq,9);
});
test("uncertain delivery retries the same event key instead of creating a session",async()=>{
 const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);await queueCaseAgentEvent(db,f.item.id,"call:1","call_completed",{evidence_id:"synthetic"});const keys:string[]=[];
 await assert.rejects(()=>advanceCaseAgentSession(db,f.run.id,{...deps,send:async(_id,_message,key)=>{keys.push(key);throw Error("Timeout");}}));
 await advanceCaseAgentSession(db,f.run.id,{...deps,send:async(_id,_message,key)=>{keys.push(key);return {accepted_seq:10};}});assert.equal(keys[0],keys[1]);
});
test("revocation cancels the existing session and prevents event delivery",async()=>{
 const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);await db.update(caseAuthorities).set({state:"revoked"}).where(eq(caseAuthorities.id,f.authority.id));let cancelled=0;
 await advanceCaseAgentSession(db,f.run.id,{...deps,cancel:async()=>{cancelled++;},send:async()=>{throw Error("Must not send");}});assert.equal(cancelled,1);assert.equal((await get(f.run.id)).state,"stopped");
});
test("budget pause requires review without replacing or funding the session",async()=>{
 const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);const before=(await get(f.run.id)).session_id;
 await advanceCaseAgentSession(db,f.run.id,{...deps,read:async()=>({status:"idle",stop_reason:"budget_paused",pending_actions:[]})});assert.equal((await get(f.run.id)).state,"human_required");assert.equal((await get(f.run.id)).session_id,before);
});

test("revocation during provider read prevents the queued wake",async()=>{
 const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);await queueCaseAgentEvent(db,f.item.id,"reply:race","reply_received",{});let cancelled=0;
 await advanceCaseAgentSession(db,f.run.id,{...deps,read:async()=>{await db.update(caseAuthorities).set({state:"revoked"}).where(eq(caseAuthorities.id,f.authority.id));return {status:"idle",stop_reason:"end_turn",pending_actions:[]};},send:async()=>{throw Error("Must not wake revoked case");},cancel:async()=>{cancelled++;}});
 assert.equal(cancelled,1);assert.equal((await get(f.run.id)).state,"stopped");
});
test("failed start backs off and retries the same session-create idempotency key",async()=>{
 const f=await fixture();const keys:string[]=[];
 await pollCaseAgentSessions(db,{...deps,start:async(_input,key)=>{keys.push(key);throw Error("Provider at capacity");}});assert.equal(keys.length,1);assert.ok((await get(f.run.id)).lease_until!>new Date());
 await db.update(caseAgentSessions).set({lease_until:new Date(0),next_check_at:new Date(0)}).where(eq(caseAgentSessions.id,f.run.id));
 await pollCaseAgentSessions(db,{...deps,start:async(input,key)=>{keys.push(key);return deps.start(input,key);}});assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);
});


test("a mismatched remote binding prevents session creation",async()=>{
 const f=await fixture();let starts=0;
 await advanceCaseAgentSession(db,f.run.id,{...deps,verifyBinding:async()=>false,start:async input=>{starts++;return {id:"ses_must_not_start"};}});
 assert.equal(starts,0);assert.equal((await get(f.run.id)).state,"human_required");assert.equal((await get(f.run.id)).session_id,null);
});
