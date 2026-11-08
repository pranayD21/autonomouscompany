import {NaiveDeferred} from "../backend/providers/naive-capacity";
import {automaticallyConfirmCaseTool,confirmCaseApproval,readCaseApprovals,pendingHash,type ApprovalProvider,type Pending} from "../backend/case-agent-approval";
import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq,inArray,sql} from "drizzle-orm";
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

for(const change of ["authority","credential","operator"] as const){
 test(`${change} revocation during binding verification prevents session creation`,async()=>{
  const f=await fixture();let starts=0;
  try{
   await advanceCaseAgentSession(db,f.run.id,{...deps,verifyBinding:async()=>{
    if(change==="authority")await db.update(caseAuthorities).set({state:"revoked"}).where(eq(caseAuthorities.id,f.authority.id));
    if(change==="credential")await db.update(caseToolCredentials).set({revoked_at:new Date()}).where(eq(caseToolCredentials.id,f.credential.id));
    if(change==="operator")process.env.CREW_ALLOWED_USER_IDS="";
    return true;
   },start:async()=>{starts++;return {id:"ses_must_not_start"};}});
   assert.equal(starts,0);assert.equal((await get(f.run.id)).state,"stopped");assert.equal((await get(f.run.id)).session_id,null);
  }finally{process.env.CREW_ALLOWED_USER_IDS=owner;}
 });
}

test("idle sessions do no Naïve work until new evidence or a due followup",async()=>{
 const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);
 await advanceCaseAgentSession(db,f.run.id,deps);assert.equal((await get(f.run.id)).state,"idle");
 let reads=0;const d={...deps,read:async()=>{reads++;return deps.read("existing");}};
 await advanceCaseAgentSession(db,f.run.id,d);assert.equal(reads,0);
 await queueCaseAgentEvent(db,f.item.id,"revision:2","evidence_updated",{revision:2});
 await advanceCaseAgentSession(db,f.run.id,d);assert.equal(reads,1);
 await advanceCaseAgentSession(db,f.run.id,deps);
 await db.update(caseAuthorities).set({next_wake_at:new Date(Date.now()-1000)}).where(eq(caseAuthorities.id,f.authority.id));
 await advanceCaseAgentSession(db,f.run.id,d);assert.equal(reads,2);
});

for(const status of ["completed","failed","cancelled"]){
 test(`terminal ${status} session never receives a queued wake or replacement`,async()=>{
  const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);
  const sessionId=(await get(f.run.id)).session_id;
  await queueCaseAgentEvent(db,f.item.id,`terminal:${status}`,"reply_received",{});
  await advanceCaseAgentSession(db,f.run.id,{...deps,read:async()=>({status,stop_reason:"end_turn",pending_actions:[]}),send:async()=>{throw Error("Terminal session must not receive input");},start:async()=>{throw Error("Must not replace terminal session");}});
  const result=await get(f.run.id);assert.equal(result.state,"human_required");assert.equal(result.session_id,sessionId);assert.equal(result.next_check_at,null);
  assert.match(result.reason!,new RegExp(`provider session is ${status}`));
  const [event]=await db.select().from(caseAgentEvents).where(eq(caseAgentEvents.run_id,f.run.id));assert.equal(event.delivered_at,null);
 });
}

async function approvalFixture(){const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);await db.update(caseAgentSessions).set({state:"human_required"}).where(eq(caseAgentSessions.id,f.run.id));const action:Pending={kind:"tool",name:"assurance.case_get",tool_call_id:"call_demo",args:{case_id:f.item.id},parked_seq:3};let confirmations=0;const provider:ApprovalProvider={read:async()=>({status:"idle",stop_reason:"awaiting_approval",pending_actions:[action]}),confirm:async(_id,input)=>{confirmations++;assert.equal(input.scope,"call");return{status:"running",stop_reason:null,pending_actions:[]};}};return{...f,action,provider,count:()=>confirmations};}
test("owner confirmation is audited, resumes the same session, and is not replayed",async()=>{
 const f=await approvalFixture(),before=await get(f.run.id);
 const review=await readCaseApprovals(db,f.item.id,f.run.id,owner,f.provider);assert.equal(review.actions[0].supported,true);
 assert.deepEqual(await confirmCaseApproval(db,f.item.id,f.run.id,owner,review.actions[0].hash,"allow",f.provider),{state:"confirmed"});
 await confirmCaseApproval(db,f.item.id,f.run.id,owner,review.actions[0].hash,"allow",f.provider);assert.equal(f.count(),1);
 assert.equal((await get(f.run.id)).session_id,before.session_id);assert.equal((await get(f.run.id)).state,"running");
 assert.equal((await readCaseApprovals(db,f.item.id,f.run.id,owner,f.provider)).history[0].state,"confirmed");
});
test("cross-owner and stale turn confirmations cannot reach the provider",async()=>{
 const f=await approvalFixture();await assert.rejects(()=>readCaseApprovals(db,f.item.id,f.run.id,"other",f.provider),/NOT_FOUND/);
 await assert.rejects(()=>confirmCaseApproval(db,f.item.id,f.run.id,"other",pendingHash(f.action),"allow",f.provider),/NOT_FOUND/);
 const stale=pendingHash(f.action);f.action.parked_seq=9;
 await assert.rejects(()=>confirmCaseApproval(db,f.item.id,f.run.id,owner,stale,"allow",f.provider),/STALE/);assert.equal(f.count(),0);
});
test("uncertain provider confirmation is recorded and never automatically replayed",async()=>{
 const f=await approvalFixture();let calls=0;const provider={...f.provider,confirm:async()=>{calls++;throw Error("Timeout");}};
 assert.deepEqual(await confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"allow",provider),{state:"uncertain"});
 await confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"allow",provider);assert.equal(calls,1);assert.equal((await get(f.run.id)).state,"human_required");
 await assert.rejects(()=>confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"deny",provider),/CONFLICT/);
});
test("credential revoked during provider read prevents confirmation",async()=>{
 const f=await approvalFixture();
 const provider={...f.provider,read:async()=>{await db.update(caseToolCredentials).set({revoked_at:new Date()}).where(eq(caseToolCredentials.id,f.credential.id));return f.provider.read("unused");}};
 await assert.rejects(()=>confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"allow",provider),/BINDING_NOT_ACTIVE/);assert.equal(f.count(),0);
});
test("cross-case and unrecognized tool approvals stay unsupported",async()=>{
 const f=await approvalFixture();f.action.args={case_id:randomUUID()};
 await assert.rejects(()=>confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"allow",f.provider),/UNSUPPORTED/);
 f.action.args={case_id:f.item.id};f.action.name="wallet.pay";
 assert.equal((await readCaseApprovals(db,f.item.id,f.run.id,owner,f.provider)).actions[0].supported,false);assert.equal(f.count(),0);
});

test("local capacity deferral does not record an uncertain confirmation",async()=>{
 const f=await approvalFixture();
 await assert.rejects(()=>confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"allow",{...f.provider,confirm:async()=>{throw new NaiveDeferred(30000);}}),NaiveDeferred);
 assert.equal((await readCaseApprovals(db,f.item.id,f.run.id,owner,f.provider)).history.length,0);
 assert.deepEqual(await confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"allow",f.provider),{state:"confirmed"});assert.equal(f.count(),1);
});

for(const change of ["none","authority","authority_expiry","credential","credential_expiry","operator","owner"] as const){
 test(`paused session scheduler honors ${change} authorization change without inference`,async()=>{
  // Isolate this scheduler check from earlier paused fixtures.
  if(ids.length)await db.update(caseAgentSessions).set({state:"stopped"}).where(inArray(caseAgentSessions.case_id,ids));
  const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);
  const sessionId=(await get(f.run.id)).session_id;
  await db.update(caseAgentSessions).set({state:"human_required",next_check_at:null}).where(eq(caseAgentSessions.id,f.run.id));
  let cancelled=0;
  try{
   if(change==="authority")await db.update(caseAuthorities).set({state:"revoked"}).where(eq(caseAuthorities.id,f.authority.id));
   if(change==="authority_expiry")await db.update(caseAuthorities).set({policy:{...policy,expires_at:new Date(0).toISOString()}}).where(eq(caseAuthorities.id,f.authority.id));
   if(change==="credential")await db.update(caseToolCredentials).set({revoked_at:new Date()}).where(eq(caseToolCredentials.id,f.credential.id));
   if(change==="credential_expiry")await db.update(caseToolCredentials).set({expires_at:new Date(0)}).where(eq(caseToolCredentials.id,f.credential.id));
   if(change==="operator")process.env.CREW_ALLOWED_USER_IDS="";
   if(change==="owner")await db.update(cases).set({owner_id:randomUUID()}).where(eq(cases.id,f.item.id));
   const guarded={...deps,start:async()=>{throw Error("No new inference");},read:async()=>{throw Error("No remote status polling");},send:async()=>{throw Error("No wake");},cancel:async(id:string)=>{assert.equal(id,sessionId);cancelled++;}};
   const result=await pollCaseAgentSessions(db,guarded);
   assert.equal(result.failed,0);assert.equal(result.checked,change==="none"?0:1);
   assert.equal(cancelled,change==="none"?0:1);
   assert.equal((await get(f.run.id)).state,change==="none"?"human_required":"stopped");
  }finally{process.env.CREW_ALLOWED_USER_IDS=owner;}
 });
}

for(const change of ["owner","operator","credential_owner","credential_case","authority_owner"] as const){
 test(`${change} change during provider read prevents event delivery`,async()=>{
  const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);
  const sessionId=(await get(f.run.id)).session_id;
  await queueCaseAgentEvent(db,f.item.id,`reply:${change}`,"reply_received",{});
  let cancelled=0,sends=0;
  try{
   await advanceCaseAgentSession(db,f.run.id,{...deps,read:async()=>{
    if(change==="owner")await db.update(cases).set({owner_id:randomUUID()}).where(eq(cases.id,f.item.id));
    if(change==="operator")process.env.CREW_ALLOWED_USER_IDS="";
    if(change==="credential_owner")await db.update(caseToolCredentials).set({issued_by:randomUUID()}).where(eq(caseToolCredentials.id,f.credential.id));
    if(change==="credential_case"){const other=await fixture();await db.update(caseToolCredentials).set({case_id:other.item.id}).where(eq(caseToolCredentials.id,f.credential.id));}
    if(change==="authority_owner")await db.update(caseAuthorities).set({approved_by:randomUUID()}).where(eq(caseAuthorities.id,f.authority.id));
    return {status:"idle",stop_reason:"end_turn",pending_actions:[]};
   },send:async()=>{sends++;return {accepted_seq:99};},cancel:async(id)=>{assert.equal(id,sessionId);cancelled++;}});
   assert.equal(sends,0);assert.equal(cancelled,1);assert.equal((await get(f.run.id)).state,"stopped");
   const [event]=await db.select().from(caseAgentEvents).where(eq(caseAgentEvents.run_id,f.run.id));assert.equal(event.delivered_at,null);
  }finally{process.env.CREW_ALLOWED_USER_IDS=owner;}
 });
}

test("reply and due followup survive together through one session until final stop",async()=>{
 const f=await fixture(),sessionId=`ses_${randomUUID()}`;
 let starts=0,cancels=0;
 const deliveries:{session:string;key:string;message:string}[]=[];
 const provider:CaseSessionDependencies={...deps,
  start:async(input)=>{starts++;assert.equal(input.budget_micro_usd,250000);return {id:sessionId};},
  send:async(session,message,key)=>{deliveries.push({session,message,key});return {accepted_seq:deliveries.length};},
  cancel:async(id)=>{assert.equal(id,sessionId);cancels++;}
 };
 await advanceCaseAgentSession(db,f.run.id,provider);
 await advanceCaseAgentSession(db,f.run.id,provider);
 assert.equal((await get(f.run.id)).state,"idle");
 // A reply arrives while an already scheduled followup becomes due.
 await queueCaseAgentEvent(db,f.item.id,"reply:lifecycle","reply_received",{fictional:true});
 const due=new Date(Date.now()-1000);
 await db.update(caseAuthorities).set({state:"waiting",next_wake_at:due}).where(eq(caseAuthorities.id,f.authority.id));
 await advanceCaseAgentSession(db,f.run.id,provider);
 await advanceCaseAgentSession(db,f.run.id,provider);
 await advanceCaseAgentSession(db,f.run.id,provider);
 const events=await db.select().from(caseAgentEvents).where(eq(caseAgentEvents.run_id,f.run.id));
 assert.deepEqual(events.map(e=>e.kind).sort(),["followup_due","reply_received"]);
 assert.ok(events.every(e=>e.delivered_at&&e.accepted_seq));
 assert.equal(deliveries.length,2);assert.equal(new Set(deliveries.map(d=>d.key)).size,2);
 assert.ok(deliveries.every(d=>d.session===sessionId));
 const [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,f.authority.id));
 assert.equal(authority.next_wake_at,null);assert.deepEqual(authority.policy,f.authority.policy);
 assert.equal(authority.decisions_used,f.authority.decisions_used);assert.equal(authority.outbound_used,f.authority.outbound_used);
 // A late reply cannot restart a case whose existing authority has ended.
 await db.update(caseAuthorities).set({state:"stopped",reason:"Synthetic lifecycle complete"}).where(eq(caseAuthorities.id,f.authority.id));
 await queueCaseAgentEvent(db,f.item.id,"reply:late","reply_received",{fictional:true});
 await advanceCaseAgentSession(db,f.run.id,provider);
 await advanceCaseAgentSession(db,f.run.id,provider);
 assert.equal(starts,1);assert.equal(cancels,1);assert.equal(deliveries.length,2);
 assert.equal((await get(f.run.id)).state,"stopped");
 const late=(await db.select().from(caseAgentEvents).where(eq(caseAgentEvents.run_id,f.run.id))).find(e=>e.event_key==="reply:late");
 assert.equal(late?.delivered_at,null);
});

for(const status of [429,503])test(`provider HTTP ${status} approval preserves rejection versus uncertainty`,async()=>{
 const f=await approvalFixture();const error=Object.assign(Error("Provider unavailable"),{status});
 const attempt=()=>confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"allow",{...f.provider,confirm:async()=>{throw error;}});
 if(status===429){
  await assert.rejects(attempt,error);
  assert.equal((await readCaseApprovals(db,f.item.id,f.run.id,owner,f.provider)).history.length,0);
  assert.deepEqual(await confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"allow",f.provider),{state:"confirmed"});
 }else{
  assert.deepEqual(await attempt(),{state:"uncertain"});
  assert.deepEqual(await confirmCaseApproval(db,f.item.id,f.run.id,owner,pendingHash(f.action),"allow",f.provider),{state:"uncertain"});
  assert.equal(f.count(),0);
 }
});

test("capacity rejection preserves the session and event until the shared cooldown",async()=>{
 if(ids.length)await db.update(caseAgentSessions).set({state:"stopped"}).where(inArray(caseAgentSessions.case_id,ids));
 const f=await fixture();await advanceCaseAgentSession(db,f.run.id,deps);
 const sessionId=(await get(f.run.id)).session_id!;await queueCaseAgentEvent(db,f.item.id,"capacity:event","reply_received",{});
 const retryAt=new Date(Date.now()+3600000);
 await db.execute((await import('drizzle-orm')).sql`INSERT INTO advocacy_naive_capacity(id,next_allowed_at) VALUES ('naive',${retryAt.toISOString()}) ON CONFLICT(id) DO UPDATE SET next_allowed_at=excluded.next_allowed_at,lease_until=NULL`);
 const keys:string[]=[];
 const result=await pollCaseAgentSessions(db,{...deps,send:async(id,_message,key)=>{assert.equal(id,sessionId);keys.push(key);throw Object.assign(Error("at capacity"),{status:429});}});
 assert.equal(result.failed,0);assert.equal(result.deferred,1);
 const run=await get(f.run.id);assert.equal(run.session_id,sessionId);assert.equal(run.next_check_at?.getTime(),retryAt.getTime());
 const [event]=await db.select().from(caseAgentEvents).where(eq(caseAgentEvents.run_id,f.run.id));assert.equal(event.delivered_at,null);
 await db.update(caseAgentSessions).set({next_check_at:new Date(0),lease_until:null}).where(eq(caseAgentSessions.id,f.run.id));
 await pollCaseAgentSessions(db,{...deps,send:async(id,_message,key)=>{assert.equal(id,sessionId);keys.push(key);return {accepted_seq:42};}});
 assert.deepEqual(keys,[`case-event:${event.id}`,`case-event:${event.id}`]);
 assert.equal((await db.select().from(caseAgentEvents).where(eq(caseAgentEvents.id,event.id)))[0].accepted_seq,42);
});

async function openFixture(){
 if(ids.length)await db.update(caseAgentSessions).set({state:"stopped"}).where(inArray(caseAgentSessions.case_id,ids));
 const [item]=await db.insert(cases).values({owner_id:owner,title:"Open Naïve case fixture"}).returning();ids.push(item.id);
 const result=await db.execute(sql`INSERT INTO advocacy_case_authorities(case_id,approved_by,policy) VALUES(${item.id},${owner},${JSON.stringify({version:2,consent:"Handle this fictional case. No external contact in this test."})}::jsonb) RETURNING id`);
 const authorityId=result.rows[0].id as string;
 const credential=await issueCaseToolCredential(db,item.id,owner,authorityId);
 const input={case_id:item.id,authority_id:authorityId,credential_id:credential.id,identity_id:`idn_${randomUUID()}`,agent_id:"agt_test",agent_version:18};
 const run=await registerCaseAgentSession(db,input,owner);return {item,authorityId,credential,input,run};
}
test("v2 starts without legacy operator/expiry limits and preserves its session through evidence and human help",async()=>{
 const previous=process.env.NAIVE_OPEN_SESSION_BUDGET_MICRO_USD;
 process.env.NAIVE_OPEN_SESSION_BUDGET_MICRO_USD="1000000";process.env.CREW_ALLOWED_USER_IDS="";
 try{
  const f=await openFixture();assert.equal(f.credential.expires_at,null);
  let starts=0,sends=0,cancels=0;
  const provider:CaseSessionDependencies={...deps,verifyBinding:async b=>{assert.equal(b.open_permission,true);return true;},start:async(input)=>{starts++;assert.equal(input.budget_micro_usd,1000000);return {id:"ses_open_fixture"};},send:async()=>{sends++;return {accepted_seq:sends};},cancel:async()=>{cancels++;}};
  await advanceCaseAgentSession(db,f.run.id,provider);
  await queueCaseAgentEvent(db,f.item.id,"open:reply","reply_received",{});
  await advanceCaseAgentSession(db,f.run.id,provider);assert.equal(sends,1);
  await db.update(caseAuthorities).set({state:"human_required",reason:"Owner decision needed"}).where(eq(caseAuthorities.id,f.authorityId));
  await pollCaseAgentSessions(db,provider);assert.equal((await get(f.run.id)).state,"human_required");assert.equal(cancels,0);
  await queueCaseAgentEvent(db,f.item.id,"open:untrusted","reply_received",{});
  await advanceCaseAgentSession(db,f.run.id,provider);assert.equal(sends,1);assert.equal(cancels,0);
  await db.update(caseAuthorities).set({state:"revoked"}).where(eq(caseAuthorities.id,f.authorityId));
  await pollCaseAgentSessions(db,provider);assert.equal((await get(f.run.id)).state,"stopped");assert.equal(cancels,1);assert.equal(starts,1);
 }finally{process.env.CREW_ALLOWED_USER_IDS=owner;if(previous===undefined)delete process.env.NAIVE_OPEN_SESSION_BUDGET_MICRO_USD;else process.env.NAIVE_OPEN_SESSION_BUDGET_MICRO_USD=previous;}
});
test("v2 pause during binding verification parks without starting or cancelling a session",async()=>{
 const f=await openFixture();let starts=0;
 await advanceCaseAgentSession(db,f.run.id,{...deps,verifyBinding:async()=>{await db.update(caseAuthorities).set({state:"human_required"}).where(eq(caseAuthorities.id,f.authorityId));return true;},start:async()=>{starts++;return {id:"ses_forbidden"};}});
 assert.equal(starts,0);assert.equal((await get(f.run.id)).state,"human_required");
});

async function openApprovalFixture(name="assurance.request_human"){
 const f=await openFixture();
 await db.update(caseAgentSessions).set({session_id:`ses_${randomUUID()}`,state:"running"}).where(eq(caseAgentSessions.id,f.run.id));
 const action:Pending={kind:"tool",name,tool_call_id:"call_open",parked_seq:5,args:{case_id:f.item.id,authority_id:f.authorityId,question:"Which insurer?"}};
 let calls=0;
 const provider:ApprovalProvider={read:async()=>({status:"idle",stop_reason:"awaiting_approval",pending_actions:[action]}),confirm:async()=>{calls++;return {status:"running",stop_reason:null,pending_actions:[]};}};
 return {...f,action,provider,calls:()=>calls};
}
test("v2 auto approval runs supported same-case tool under standing permission without operator membership",async()=>{
 const f=await openApprovalFixture();process.env.CREW_ALLOWED_USER_IDS="";
 try{
  await advanceCaseAgentSession(db,f.run.id,{...deps,read:f.provider.read,autoApprove:(db,caseId,runId,owner)=>automaticallyConfirmCaseTool(db,caseId,runId,owner,f.provider)});
  assert.equal(f.calls(),1);assert.equal((await get(f.run.id)).state,"running");
  assert.equal((await readCaseApprovals(db,f.item.id,f.run.id,owner,f.provider)).history[0].state,"confirmed");
 }finally{process.env.CREW_ALLOWED_USER_IDS=owner;}
});
test("v2 auto approval rejects arbitrary builtins, cross-case tools, and missing action authority",async()=>{
 const f=await openApprovalFixture();
 for(const mutation of [()=>{f.action.name="web_fetch";},()=>{f.action.name="assurance.case_get";f.action.args={case_id:randomUUID()};},()=>{f.action.name="assurance.send_email";f.action.args={case_id:f.item.id};}]){
  mutation();assert.equal((await automaticallyConfirmCaseTool(db,f.item.id,f.run.id,owner,f.provider)).state,"unsupported");
 }
 assert.equal(f.calls(),0);
});
test("v2 auto approval preserves durable uncertainty and never replays confirmation",async()=>{
 const f=await openApprovalFixture();let calls=0;
 const provider={...f.provider,confirm:async()=>{calls++;throw Error("Timeout after acceptance");}};
 assert.equal((await automaticallyConfirmCaseTool(db,f.item.id,f.run.id,owner,provider)).state,"uncertain");
 assert.equal((await automaticallyConfirmCaseTool(db,f.item.id,f.run.id,owner,provider)).state,"uncertain");
 assert.equal(calls,1);assert.equal((await get(f.run.id)).state,"human_required");
 const history=(await readCaseApprovals(db,f.item.id,f.run.id,owner,provider)).history;assert.equal(history.length,1);assert.equal(history[0].state,"uncertain");
});
test("v2 auto approval admission rejection preserves safe same-action retry",async()=>{
 const f=await openApprovalFixture();let calls=0;
 const rejected={...f.provider,confirm:async()=>{calls++;throw Object.assign(Error("rate limit"),{status:429});}};
 await assert.rejects(()=>automaticallyConfirmCaseTool(db,f.item.id,f.run.id,owner,rejected));
 assert.equal((await readCaseApprovals(db,f.item.id,f.run.id,owner,f.provider)).history.length,0);
 assert.equal((await automaticallyConfirmCaseTool(db,f.item.id,f.run.id,owner,f.provider)).state,"confirmed");assert.equal(calls,1);assert.equal(f.calls(),1);
});
test("v2 auto approval clears a visible batch in one pass and stops when the session moves on",async()=>{
 const f=await openApprovalFixture();const pending=(n:number)=>({status:"idle",stop_reason:"awaiting_approval",pending_actions:Array.from({length:n},()=>({}))});
 const states=[pending(3),pending(2),pending(1)];let approvals=0;let reads=0;
 await advanceCaseAgentSession(db,f.run.id,{...deps,read:async()=>states[reads++]??{status:"running",stop_reason:null,pending_actions:[]},autoApprove:async()=>{approvals++;return {state:"confirmed"};}} as CaseSessionDependencies);
 assert.equal(approvals,3);
 const moved=[pending(3),{status:"running",stop_reason:null,pending_actions:[]}];let movedApprovals=0,movedReads=0;
 await advanceCaseAgentSession(db,f.run.id,{...deps,read:async()=>moved[movedReads++],autoApprove:async()=>{movedApprovals++;return {state:"confirmed"};}} as CaseSessionDependencies);
 assert.equal(movedApprovals,1);
});

