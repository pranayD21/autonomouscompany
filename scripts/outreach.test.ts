import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq} from "drizzle-orm";
import {cases,outreachActions} from "../backend/schema";
import {dispatchOnce} from "../backend/outreach-service";
import {elevenLabsOutreachPrompt} from "../backend/providers/voice-config";
import {actionInput,destinationAllowed,DispatchFailure,sendOutreach,readOutreach} from "../backend/providers/outreach";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw new Error("Use an isolated Neon test branch via OUTREACH_TEST_DATABASE_URL");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:4});
const db=drizzle(pool);const owner=`outreach-test-${randomUUID()}`;
const [item]=await db.insert(cases).values({owner_id:owner,title:"Synthetic outreach test",bill_cents:120000,eob_cents:40000}).returning();
async function draft(kind:"call"|"email"="call") {
 const [a]=await db.insert(outreachActions).values({id:randomUUID(),case_id:item.id,kind,destination:kind==="call"?"+12025550123":"synthetic@example.com",subject:"Synthetic demo",body:"Request fictional itemized bill"}).returning();return a;
}
after(async()=>{await db.delete(outreachActions).where(eq(outreachActions.case_id,item.id));await db.delete(cases).where(eq(cases.id,item.id));await pool.end();});
test("concurrent authorizations dispatch exactly once and persist approver and receipt",async()=>{
 const a=await draft();let calls=0;const sender=async()=>{calls++;await new Promise(r=>setTimeout(r,30));return {provider_id:"call-test",provider_status:"ringing"};};
 await Promise.all(Array.from({length:8},()=>dispatchOnce(db,a,owner,sender)));
 const [saved]=await db.select().from(outreachActions).where(eq(outreachActions.id,a.id));
 assert.equal(calls,1);assert.equal(saved.state,"submitted");assert.equal(saved.approved_by,owner);assert.ok(saved.approved_at);assert.equal(saved.provider_id,"call-test");
});
test("network ambiguity is durable and cannot redial on retry",async()=>{
 const a=await draft();let calls=0;const sender=async()=>{calls++;throw new Error("timeout after possible acceptance")};
 assert.equal((await dispatchOnce(db,a,owner,sender)).state,"unknown");
 assert.equal((await dispatchOnce(db,a,owner,sender)).state,"unknown");assert.equal(calls,1);
});
test("definite funding rejection is visible and not automatically retried",async()=>{
 const a=await draft();let calls=0;const sender=async()=>{calls++;throw new DispatchFailure("HTTP_402",true)};
 assert.equal((await dispatchOnce(db,a,owner,sender)).state,"rejected");await dispatchOnce(db,a,owner,sender);assert.equal(calls,1);
});
test("interrupted dispatch remains reserved",async()=>{
 const a=await draft();await db.update(outreachActions).set({state:"dispatching"}).where(eq(outreachActions.id,a.id));
 let calls=0;await dispatchOnce(db,a,owner,async()=>{calls++;return{provider_id:"unexpected",provider_status:"ringing"}});assert.equal(calls,0);
});
test("email uses immutable content and action ID as provider idempotency key",async()=>{
 const a=await draft("email");const request=(async(url,init)=>{assert.ok(String(url).endsWith("/messages/send"));const headers=new Headers(init?.headers);assert.equal(headers.get("Idempotency-Key"),a.id);const body=JSON.parse(String(init?.body));assert.deepEqual(body.to,[a.destination]);assert.equal(body.text,a.body);assert.equal(body.track_opens,false);return Response.json({message_id:"m1",thread_id:"t1"});}) as typeof fetch;
 assert.equal((await sendOutreach(a,request)).provider_id,"m1");
});
test("a threaded follow-up keeps the authorized recipient and rejects a mismatched thread receipt",async()=>{
 const a={...await draft("email"),reply_to_message_id:"<original@example.com>",reply_thread_id:"original-thread"};
 let calls=0;const request=(async(url,init)=>{calls++;assert.ok(String(url).endsWith("/%3Coriginal%40example.com%3E/reply"));const body=JSON.parse(String(init?.body));assert.deepEqual(body.to,[a.destination]);assert.equal(body.reply_all,false);assert.deepEqual(body.cc,[]);assert.deepEqual(body.bcc,[]);assert.equal(body.subject,undefined);assert.equal(body.text,a.body);return Response.json({message_id:"follow-up",thread_id:"original-thread"});}) as typeof fetch;
 assert.equal((await sendOutreach(a,request)).provider_thread_id,"original-thread");assert.equal(calls,1);
 await assert.rejects(()=>sendOutreach(a,(async()=>Response.json({message_id:"other",thread_id:"wrong-thread"})) as typeof fetch),e=>e instanceof DispatchFailure&&e.code==="REPLY_THREAD_MISMATCH"&&!e.definiteRejection);
 await assert.rejects(()=>sendOutreach({...a,reply_thread_id:null},request),/INVALID_REPLY_CONTEXT/);assert.equal(calls,1);
});
test("call disables audio recording, carries reviewed plan, and validates receipt",async()=>{
 process.env.ELEVENLABS_API_KEY="test";process.env.ELEVENLABS_OUTREACH_AGENT_ID="test";process.env.ELEVENLABS_PHONE_NUMBER_ID="test";
 const a=await draft();const request=(async(_url,init)=>{if(!init?.method)return Response.json({conversation_config:{agent:{prompt:{prompt:elevenLabsOutreachPrompt}},conversation:{max_duration_seconds:180}},platform_settings:{privacy:{record_voice:false},auth:{enable_auth:true}}});const body=JSON.parse(String(init?.body));assert.equal(body.call_recording_enabled,false);assert.equal(body.to_number,a.destination);assert.ok(body.conversation_initiation_client_data.dynamic_variables.discussion_plan.includes(a.body));return Response.json({success:true,conversation_id:"c1",callSid:"CA-test"});}) as typeof fetch;
 assert.equal((await sendOutreach(a,request)).provider_id,"elevenlabs:c1");
 await assert.rejects(()=>sendOutreach(a,(async(url,init)=>init?.method?Response.json({accepted:true}):request(url,init)) as typeof fetch),/INVALID_PROVIDER_RESPONSE/);
});
test("status reads cannot send and discard transcripts and message bodies",async()=>{
 const a={...await draft(),provider_id:"c1"};const result=await readOutreach(a,(async(_url,init)=>{assert.equal(init?.method,undefined);return Response.json({id:"c1",status:"completed",durationSeconds:46,transcript:"not retained"});}) as typeof fetch);
 assert.deepEqual(result,{provider_status:"completed",duration_seconds:46});
});
test("destination and synthetic validation fail closed",()=>{
 const base={id:randomUUID(),kind:"email",destination:"synthetic@example.com",subject:"demo",body:"demo",synthetic:true};
 assert.equal(actionInput.safeParse({...base,synthetic:false}).success,false);
 assert.equal(actionInput.safeParse({...base,destination:"a@example.com,b@example.com"}).success,false);
 assert.equal(actionInput.safeParse({...base,subject:"Hi\r\nBcc: other@example.com"}).success,false);
 assert.equal(destinationAllowed("email","not-configured@example.com"),false);
});

test("a draft cannot dispatch after its case revision changes",async()=>{
 const a=await draft();await db.update(cases).set({revision:2}).where(eq(cases.id,item.id));
 let calls=0;const current=await dispatchOnce(db,a,owner,async()=>{calls++;return{provider_id:"unexpected",provider_status:"sent"}});
 assert.equal(calls,0);assert.equal(current.state,"draft");
});
