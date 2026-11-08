import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq,inArray,sql} from "drizzle-orm";
import {cases,outreachActions,replyMonitors} from "../backend/schema";
import {setReplyMonitoring,pollReplyMonitors} from "../backend/reply-monitor";
import type {syncReplies} from "../backend/reply-service";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Use an isolated Neon branch");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:5,connectionTimeoutMillis:15000,query_timeout:30000});const db=drizzle(pool);
const owner=`monitor-test-${randomUUID()}`;const [item]=await db.insert(cases).values({owner_id:owner,title:"Synthetic scheduled reply checks"}).returning();const ids:string[]=[];
async function action(authorized=true){const id=randomUUID();ids.push(id);const [a]=await db.insert(outreachActions).values({id,case_id:item.id,kind:"email",destination:"claims@example.com",subject:"Synthetic",body:"Synthetic",approved_at:authorized?new Date():null,provider_id:authorized?`msg-${id}`:null,provider_thread_id:authorized?`thread-${id}`:null}).returning();return a;}
const success:typeof syncReplies=async()=>({imported:0,changed:0,held:0,partial:false,revision:1});
const get=async(id:string)=>(await db.select().from(replyMonitors).where(eq(replyMonitors.action_id,id)))[0];
after(async()=>{if(ids.length){await db.delete(replyMonitors).where(inArray(replyMonitors.action_id,ids));await db.delete(outreachActions).where(inArray(outreachActions.id,ids));}await db.delete(cases).where(eq(cases.id,item.id));await pool.end();});
test("only the owner can enable monitoring of an authorized email thread",async()=>{
 const a=await action();await assert.rejects(()=>setReplyMonitoring(db,item.id,a.id,"other",true),/NOT_FOUND/);assert.equal(await get(a.id),undefined);
 const draft=await action(false);await assert.rejects(()=>setReplyMonitoring(db,item.id,draft.id,owner,true),/NO_AUTHORIZED_THREAD/);
 const enabled=await setReplyMonitoring(db,item.id,a.id,owner,true);assert.equal(enabled.enabled,true);assert.ok(enabled.expires_at.getTime()>Date.now()+29*86400000);
 await setReplyMonitoring(db,item.id,a.id,owner,false);
});
test("overlapping deliveries claim a due thread once and delay the next check",async()=>{
 const a=await action();await setReplyMonitoring(db,item.id,a.id,owner,true);let reads=0;
 const result=await Promise.all(Array.from({length:4},(_,i)=>pollReplyMonitors(db,`concurrent-${i}`,async(...args)=>{assert.equal(args[1].id,a.id);assert.equal(args[2],owner);reads++;await new Promise(r=>setTimeout(r,100));return success(...args);} )));
 assert.equal(reads,1);assert.equal(result.reduce((n,r)=>n+r.checked,0),1);const saved=await get(a.id);assert.ok(saved.last_success_at);assert.equal(saved.lease_id,null);assert.ok(saved.next_check_at.getTime()>Date.now()+14*60000);
 await pollReplyMonitors(db,"repeat",success);assert.equal((await get(a.id)).last_success_at?.getTime(),saved.last_success_at?.getTime());
});
test("provider failures back off without publishing success or leaking provider errors",async()=>{
 const a=await action();await setReplyMonitoring(db,item.id,a.id,owner,true);const result=await pollReplyMonitors(db,"failure",async()=>{throw Error("private provider details");});assert.equal(result.failed,1);
 const saved=await get(a.id);assert.equal(saved.error_code,"REPLY_CHECK_FAILED");assert.equal(saved.failures,1);assert.equal(saved.last_success_at,null);assert.equal(saved.lease_id,null);assert.ok(saved.next_check_at.getTime()>Date.now()+29*60000);
 await db.update(replyMonitors).set({next_check_at:sql`now()-interval '1 second'`}).where(eq(replyMonitors.action_id,a.id));await pollReplyMonitors(db,"recovery",success);assert.equal((await get(a.id)).failures,0);assert.equal((await get(a.id)).error_code,null);
});
test("paused, expired, and actively leased threads are skipped; expired leases recover",async()=>{
 const paused=await action(),expired=await action(),leased=await action();
 for(const a of [paused,expired,leased])await setReplyMonitoring(db,item.id,a.id,owner,true);
 await setReplyMonitoring(db,item.id,paused.id,owner,false);await db.update(replyMonitors).set({expires_at:sql`now()-interval '1 second'`}).where(eq(replyMonitors.action_id,expired.id));
 await db.update(replyMonitors).set({lease_id:randomUUID(),lease_until:sql`now()+interval '10 minutes'`}).where(eq(replyMonitors.action_id,leased.id));assert.equal((await pollReplyMonitors(db,"skip",success)).checked,0);
 await db.update(replyMonitors).set({lease_until:sql`now()-interval '1 second'`}).where(eq(replyMonitors.action_id,leased.id));assert.equal((await pollReplyMonitors(db,"recover",success)).checked,1);
});
test("a delivery handles at most five threads and preserves partial-history visibility",async()=>{
 for(let n=0;n<6;n++){const a=await action();await setReplyMonitoring(db,item.id,a.id,owner,true);}
 const partial:typeof syncReplies=async(...args)=>({...await success(...args),partial:true});
 assert.equal((await pollReplyMonitors(db,"batch",partial)).checked,5);assert.equal((await pollReplyMonitors(db,"remaining",partial)).checked,1);
 assert.equal((await get(ids.at(-1)!)).error_code,"PARTIAL_HISTORY");
});
