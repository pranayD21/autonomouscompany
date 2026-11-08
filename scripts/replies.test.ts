import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq} from "drizzle-orm";
import {cases,outreachActions,caseReplies} from "../backend/schema";
import {normalizeReply,fetchReplies,mailbox} from "../backend/providers/replies";
import {syncReplies} from "../backend/reply-service";
import {completedCrewSnapshot} from "../backend/providers/crew-result";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Use an isolated Neon test branch");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:4,connectionTimeoutMillis:15000,query_timeout:30000});const db=drizzle(pool);
const owner=`reply-test-${randomUUID()}`;const [item]=await db.insert(cases).values({owner_id:owner,title:"Synthetic reply case"}).returning();
const [action]=await db.insert(outreachActions).values({id:randomUUID(),case_id:item.id,kind:"email",destination:"claims@example.com",subject:"Synthetic",body:"Synthetic inquiry",state:"submitted",approved_by:owner,approved_at:new Date(),provider_id:"outgoing-message",provider_thread_id:"thread-one"}).returning();
const inbox="synthetic@agentmail.to";
function message(id=randomUUID()){return {inbox_id:inbox,thread_id:"thread-one",message_id:id,labels:["received"],timestamp:"2026-11-07T23:00:00Z",from:"Claims <claims@example.com>",to:[inbox],subject:"Synthetic status",extracted_text:"Please provide the fictional employer name. No claim decision has been made.",in_reply_to:"outgoing-message",authentication_results:{dmarc:"pass",dmarc_domain:"example.com"}};}
after(async()=>{await db.delete(caseReplies).where(eq(caseReplies.case_id,item.id));await db.delete(outreachActions).where(eq(outreachActions.id,action.id));await db.delete(cases).where(eq(cases.id,item.id));await pool.end();});
test("only linked expected authenticated replies qualify, never display names or forged headers",()=>{
 const m=message();assert.equal(normalizeReply(m,action,inbox)?.disposition,"accepted");
 for(const raw of [{...m,from:"claims@example.com <evil@attacker.test>"},{...m,authentication_results:undefined,headers:{"Authentication-Results":"dmarc=pass"}},{...m,in_reply_to:"unrelated"},{...m,to:["other@agentmail.to"]},{...m,agent_armor:{status:"pending"}},{...m,agent_armor:{status:"complete",verdict:"review"}},{...m,labels:["received","unauthenticated"]},{...m,extracted_text:"x".repeat(16001)}])assert.equal(normalizeReply(raw,action,inbox)?.disposition,"held");
 assert.equal(mailbox("one@example.com, Two <two@example.com>"),null);
 assert.equal(normalizeReply({...m,labels:["sent"]},action,inbox),null);
 assert.throws(()=>normalizeReply({...m,thread_id:"other"},action,inbox),/MISMATCH/);
});
test("concurrent duplicate imports change the case revision once and preserve the body hash",async()=>{
 const reply=normalizeReply(message(),action,inbox)!;const reader=async()=>({replies:[reply],partial:false});
 const results=await Promise.all(Array.from({length:6},()=>syncReplies(db,action,owner,reader)));
 assert.equal(results.reduce((n,r)=>n+r.imported,0),1);assert.equal(results.reduce((n,r)=>n+r.changed,0),1);
 const [current]=await db.select().from(cases).where(eq(cases.id,item.id));assert.equal(current.revision,2);
 const [saved]=await db.select().from(caseReplies).where(eq(caseReplies.message_id,reply.message_id));assert.equal(saved.sha256,reply.sha256);assert.equal(saved.body,reply.body);
});
test("held messages do not enter evidence; changed content revokes accepted evidence without replacing originals",async()=>{
 const raw=message();const held=normalizeReply({...raw,authentication_results:undefined},action,inbox)!;
 const before=(await db.select().from(cases).where(eq(cases.id,item.id)))[0].revision;
 await syncReplies(db,action,owner,async()=>({replies:[held],partial:false}));assert.equal((await db.select().from(cases).where(eq(cases.id,item.id)))[0].revision,before);
 const accepted=normalizeReply(raw,action,inbox)!;await syncReplies(db,action,owner,async()=>({replies:[accepted],partial:false}));
 const changed=normalizeReply({...raw,extracted_text:"A materially different message"},action,inbox)!;await syncReplies(db,action,owner,async()=>({replies:[changed],partial:false}));
 await syncReplies(db,action,owner,async()=>({replies:[accepted],partial:false}));
 const [saved]=await db.select().from(caseReplies).where(eq(caseReplies.message_id,raw.message_id));assert.equal(saved.disposition,"held");assert.equal(saved.body,accepted.body);assert.match(saved.reason,/content changed/);
 assert.equal((await db.select().from(cases).where(eq(cases.id,item.id)))[0].revision,before+2);
});
test("content changes while already held cannot later release the original",async()=>{
 const raw=message();const before=(await db.select().from(cases).where(eq(cases.id,item.id)))[0].revision;
 for(const variant of [{...raw,authentication_results:undefined},{...raw,extracted_text:"Different content"},raw])await syncReplies(db,action,owner,async()=>({replies:[normalizeReply(variant,action,inbox)!],partial:false}));
 const [saved]=await db.select().from(caseReplies).where(eq(caseReplies.message_id,raw.message_id));assert.equal(saved.disposition,"held");assert.match(saved.reason,/content changed/);assert.equal(saved.body,raw.extracted_text);
 assert.equal((await db.select().from(cases).where(eq(cases.id,item.id)))[0].revision,before);
});
test("provider errors and wrong owners cannot partially import replies",async()=>{
 const before=(await db.select().from(caseReplies).where(eq(caseReplies.case_id,item.id))).length;
 await assert.rejects(()=>syncReplies(db,action,owner,async()=>{throw Error("provider timeout")}),/timeout/);
 await assert.rejects(()=>syncReplies(db,action,"another-owner",async()=>({replies:[normalizeReply(message(),action,inbox)!],partial:false})),/CASE_NOT_FOUND/);
 assert.equal((await db.select().from(caseReplies).where(eq(caseReplies.case_id,item.id))).length,before);
});
test("thread pagination uses GET only, validates thread identity, and imports only received content",async()=>{
 process.env.AGENTMAIL_INBOX_ID=inbox;process.env.AGENTMAIL_API_KEY="synthetic-test-key";let calls=0;
 const result=await fetchReplies(action,(async(url,init)=>{assert.equal(init?.method,undefined);calls++;const second=new URL(String(url)).searchParams.has("page_token");return Response.json({inbox_id:inbox,thread_id:"thread-one",messages:second?[message()]:[{...message(),labels:["sent"]}],...second?{}:{next_page_token:"older"}});}) as typeof fetch);
 assert.equal(calls,2);assert.equal(result.replies.length,1);assert.equal(result.partial,false);
 await assert.rejects(()=>fetchReplies(action,(async()=>Response.json({inbox_id:inbox,thread_id:"another",messages:[]})) as typeof fetch),/MISMATCH/);
});
test("claim results cannot omit or invent correspondence references",()=>{
 const reply={reply_id:randomUUID(),sha256:"a".repeat(64)};const session={status:"completed",stop_reason:"end_turn",pending_actions:[],consumed_micro_usd:1,structured_output:{summary:"Synthetic",potential_discrepancy_cents:null,evidence:["insurer_correspondence"],missing_information:[],next_actions:[],human_help_required:true,human_help_reason:"Missing employer",reply_references:[reply]}};
 assert.equal(completedCrewSnapshot(session,null,[],undefined,[reply]).output_valid,true);
 assert.equal(completedCrewSnapshot(session,null,[],undefined,[{...reply,sha256:"b".repeat(64)}]).output_valid,false);
 assert.equal(completedCrewSnapshot({...session,structured_output:{...session.structured_output,reply_references:[]}},null,[],undefined,[reply]).output_valid,false);
});
