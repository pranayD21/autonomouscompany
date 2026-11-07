import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq} from "drizzle-orm";
import {cases,outreachActions} from "../backend/schema";
import {dispatchOnce} from "../backend/outreach-service";
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
test("call disables audio recording, carries reviewed plan, and validates receipt",async()=>{
 const a=await draft();const request=(async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.equal(body.disableRecording,true);assert.equal(body.toNumber,a.destination);assert.ok(body.systemPrompt.includes(a.body));return Response.json({id:"c1",status:"ringing"});}) as typeof fetch;
 assert.equal((await sendOutreach(a,request)).provider_id,"c1");
 await assert.rejects(()=>sendOutreach(a,(async()=>Response.json({accepted:true})) as typeof fetch),/INVALID_PROVIDER_RESPONSE/);
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
