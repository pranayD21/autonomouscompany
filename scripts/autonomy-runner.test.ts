import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq,inArray,sql} from "drizzle-orm";
import {cases,crewRuns,caseAuthorities,caseDecisions,outreachActions,replyMonitors,caseReplies} from "../backend/schema";
import {authorizeCase,revokeCaseAuthority,readCaseAutonomy} from "../backend/autonomy-service";
import {pollAutonomousCases,advanceCaseAuthority,type AutonomyDependencies} from "../backend/autonomy-runner";
import type {CaseAuthority,CaseDecision} from "../backend/autonomy-policy";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Use a disposable database branch");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:5,connectionTimeoutMillis:15000,query_timeout:30000}),db=drizzle(pool);
const owner=`autonomy-test-${randomUUID()}`,ids:string[]=[];
const policy:CaseAuthority={synthetic:true,goal:"Gather fictional employer details",contacts:[{id:"customer",role:"customer",channel:"email",destination:"customer@example.com"}],max_decisions:3,max_outbound:2,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+86400000).toISOString()};
const decision:CaseDecision={tool:"contact_customer",contact_id:"customer",subject:"Synthetic Assurance question",body:"What fictional employer should we use?",reason:"Employer is missing",evidence_refs:["case:1"]};
const deps=(choice:CaseDecision=decision):AutonomyDependencies=>({allowed:()=>true,
 start:async()=>({id:`session-${randomUUID()}`} as Awaited<ReturnType<AutonomyDependencies["start"]>>),
 read:async()=>({status:"idle",stop_reason:"end_turn",pending_actions:[],structured_output:{decision:choice}} as Awaited<ReturnType<AutonomyDependencies["read"]>>),
 send:async a=>({provider_id:`msg-${a.id}`,provider_thread_id:`thread-${a.id}`,provider_status:"accepted"}),
});
async function fixture(){const [item]=await db.insert(cases).values({owner_id:owner,title:"Synthetic autonomous case"}).returning();ids.push(item.id);
 await db.insert(crewRuns).values({case_id:item.id,message:"{}",completed_at:new Date(),snapshot:{status:"idle",stop_reason:"end_turn",consumed_micro_usd:1,result:null,output_valid:true,approval_required:false}});
 const authority=await authorizeCase(db,item.id,owner,policy,()=>true);return {item,authority};}
const get=async(id:string)=>(await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,id)))[0];
after(async()=>{if(ids.length){const grants=await db.select().from(caseAuthorities).where(inArray(caseAuthorities.case_id,ids));const actions=await db.select().from(outreachActions).where(inArray(outreachActions.case_id,ids));if(actions.length)await db.delete(replyMonitors).where(inArray(replyMonitors.action_id,actions.map(a=>a.id)));if(grants.length)await db.delete(caseDecisions).where(inArray(caseDecisions.authority_id,grants.map(g=>g.id)));await db.delete(caseAuthorities).where(inArray(caseAuthorities.case_id,ids));await db.delete(caseReplies).where(inArray(caseReplies.case_id,ids));await db.delete(outreachActions).where(inArray(outreachActions.case_id,ids));await db.delete(cases).where(inArray(cases.id,ids));}await pool.end();});
test("authority requires ownership, a completed review, approved contacts, and no active duplicate",async()=>{
 const {item,authority}=await fixture();await assert.rejects(()=>authorizeCase(db,item.id,"other",policy,()=>true),/NOT_FOUND/);
 await assert.rejects(()=>authorizeCase(db,item.id,owner,policy,()=>true),/AUTHORITY_ALREADY_EXISTS/);
 await assert.rejects(()=>readCaseAutonomy(db,item.id,"other"),/NOT_FOUND/);
 await assert.rejects(()=>revokeCaseAuthority(db,item.id,authority.id,"other"),/NOT_FOUND/);
 await revokeCaseAuthority(db,item.id,authority.id,owner);
 await assert.rejects(()=>authorizeCase(db,item.id,owner,policy,()=>false),/CONTACT_NOT_ALLOWED/);
});
test("concurrent scheduler deliveries reserve one decision; one execution sends and enables reply checks",async()=>{
 const {authority}=await fixture();let starts=0,sends=0;const d=deps();d.start=async(...args)=>{starts++;return deps().start(...args)};d.send=async(...args)=>{sends++;return deps().send(...args)};
 await Promise.all(Array.from({length:4},()=>pollAutonomousCases(db,d)));assert.equal(starts,1);assert.equal((await get(authority.id)).decisions_used,1);
 await db.update(caseAuthorities).set({next_wake_at:new Date(0)}).where(eq(caseAuthorities.id,authority.id));await Promise.all(Array.from({length:4},()=>pollAutonomousCases(db,d)));
 assert.equal(sends,1);const current=await get(authority.id);assert.equal(current.state,"waiting");assert.equal(current.outbound_used,1);
 const history=await readCaseAutonomy(db,current.case_id,owner);assert.equal(history.decisions.length,1);assert.equal(history.decisions[0].state,"finished");
 const [monitor]=await db.select().from(replyMonitors).where(eq(replyMonitors.action_id,history.decisions[0].action_id!));assert.equal(monitor.enabled,true);
 await pollAutonomousCases(db,d);assert.equal(sends,1);await revokeCaseAuthority(db,current.case_id,current.id,owner);
});
test("revocation during model read prevents dispatch and preserves revoked state",async()=>{
 const {authority,item}=await fixture();const d=deps();await advanceCaseAuthority(db,authority.id,d);d.read=async(...args)=>{await revokeCaseAuthority(db,item.id,authority.id,owner);return deps().read(...args)};d.send=async()=>{throw Error("Must not send");};
 await advanceCaseAuthority(db,authority.id,d);assert.equal((await get(authority.id)).state,"revoked");assert.equal((await db.select().from(outreachActions).where(eq(outreachActions.case_id,item.id))).length,0);
});
test("ambiguous dispatch is retained and never retried automatically",async()=>{
 const {authority,item}=await fixture();const d=deps();let attempts=0;d.send=async()=>{attempts++;throw Error("Network outcome unknown");};await advanceCaseAuthority(db,authority.id,d);await advanceCaseAuthority(db,authority.id,d);await advanceCaseAuthority(db,authority.id,d);
 assert.equal(attempts,1);assert.equal((await get(authority.id)).state,"human_required");const [action]=await db.select().from(outreachActions).where(eq(outreachActions.case_id,item.id));assert.equal(action.state,"unknown");
});
test("changed evidence discards a decision without contacting anyone",async()=>{
 const {authority,item}=await fixture();const d=deps();await advanceCaseAuthority(db,authority.id,d);await db.update(cases).set({revision:2}).where(eq(cases.id,item.id));let sends=0;d.send=async(...args)=>{sends++;return deps().send(...args)};await advanceCaseAuthority(db,authority.id,d);
 assert.equal(sends,0);const [round]=await db.select().from(caseDecisions).where(eq(caseDecisions.authority_id,authority.id));assert.equal(round.state,"finished");await revokeCaseAuthority(db,item.id,authority.id,owner);
});
test("an unsupported success claim requires human help and does not mark the goal achieved",async()=>{
 const {authority}=await fixture();const d=deps({tool:"stop_case",outcome:"goal_met",reason:"Assumed success",summary:"Claim paid",evidence_refs:["case:1"]});await advanceCaseAuthority(db,authority.id,d);await advanceCaseAuthority(db,authority.id,d);const saved=await get(authority.id);assert.equal(saved.state,"human_required");assert.equal(saved.reason,"OUTCOME_NOT_VERIFIED");
});
test("an expired grant stops without another model or dispatch request",async()=>{
 const {authority}=await fixture();await db.update(caseAuthorities).set({policy:{...policy,expires_at:new Date(0).toISOString()}}).where(eq(caseAuthorities.id,authority.id));const d=deps();d.start=async()=>{throw Error("Must not start");};await advanceCaseAuthority(db,authority.id,d);assert.equal((await get(authority.id)).state,"stopped");
});

test("new case evidence wakes a waiting decision without bypassing contact spacing",async()=>{
 const {authority,item}=await fixture();const d=deps();let starts=0,sends=0;
 d.start=async(...args)=>{starts++;return deps().start(...args)};
 d.send=async(...args)=>{sends++;return deps().send(...args)};
 await advanceCaseAuthority(db,authority.id,d);await advanceCaseAuthority(db,authority.id,d);
 assert.equal(sends,1);assert.equal((await get(authority.id)).state,"waiting");
 await db.update(cases).set({revision:2}).where(eq(cases.id,item.id));
 await pollAutonomousCases(db,d);assert.equal(starts,2);
 d.read=async()=>({status:"idle",stop_reason:"end_turn",pending_actions:[],structured_output:{decision:{...decision,evidence_refs:["case:2"]}}});
 await advanceCaseAuthority(db,authority.id,d);
 assert.equal(sends,1);const delayed=await get(authority.id);assert.equal(delayed.state,"waiting");assert.ok(delayed.next_wake_at!.getTime()>Date.now()+59*60000);await revokeCaseAuthority(db,item.id,authority.id,owner);
});
test("a model-selected wait persists its delay and does not dispatch",async()=>{
 const {authority,item}=await fixture();const d=deps({tool:"wait_for_reply",minutes:120,reason:"Awaiting fictional details",evidence_refs:["case:1"]});
 d.send=async()=>{throw Error("Must not send");};
 await advanceCaseAuthority(db,authority.id,d);await advanceCaseAuthority(db,authority.id,d);
 const saved=await get(authority.id);assert.equal(saved.state,"waiting");
 assert.ok(saved.next_wake_at!.getTime()>Date.now()+119*60000);
 await pollAutonomousCases(db,d);assert.equal((await get(authority.id)).decisions_used,1);
 await revokeCaseAuthority(db,item.id,authority.id,owner);
});

test("an accepted customer stop reply ends work without another model round or contact",async()=>{
 const {authority,item}=await fixture();const d=deps();let starts=0,sends=0;
 d.start=async(...args)=>{starts++;return deps().start(...args)};
 d.send=async(...args)=>{sends++;return deps().send(...args)};
 await advanceCaseAuthority(db,authority.id,d);await advanceCaseAuthority(db,authority.id,d);
 const [action]=await db.select().from(outreachActions).where(eq(outreachActions.case_id,item.id));
 await db.insert(caseReplies).values({case_id:item.id,action_id:action.id,inbox_id:"synthetic-inbox",message_id:randomUUID(),thread_id:action.provider_thread_id!,sender:"Demo Customer <customer@example.com>",subject:"Re: Synthetic",body:"Please stop contacting me about this synthetic test.",sha256:"a".repeat(64),disposition:"accepted",reason:"Synthetic authenticated reply fixture",received_at:new Date()});
 await db.update(cases).set({revision:2}).where(eq(cases.id,item.id));
 await pollAutonomousCases(db,d);
 assert.equal((await get(authority.id)).state,"stopped");assert.equal(starts,1);assert.equal(sends,1);
});

test("a later authorized follow-up preserves the prior thread for that case and recipient",async()=>{
 const {authority,item}=await fixture();const d=deps();const sent:Array<Parameters<AutonomyDependencies["send"]>[0]>=[];
 d.send=async a=>{sent.push(a);return {provider_id:`message-${sent.length}`,provider_thread_id:"same-thread",provider_status:"accepted"};};
 await advanceCaseAuthority(db,authority.id,d);await advanceCaseAuthority(db,authority.id,d);
 await db.update(caseAuthorities).set({last_contact_at:new Date(Date.now()-61*60000),next_wake_at:new Date(0)}).where(eq(caseAuthorities.id,authority.id));
 await advanceCaseAuthority(db,authority.id,d);await advanceCaseAuthority(db,authority.id,d);
 assert.equal(sent.length,2);assert.equal(sent[0].reply_to_message_id,null);assert.equal(sent[1].reply_to_message_id,"message-1");assert.equal(sent[1].reply_thread_id,"same-thread");assert.equal(sent[1].destination,policy.contacts[0].destination);
 await revokeCaseAuthority(db,item.id,authority.id,owner);
});
