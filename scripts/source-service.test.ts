import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq} from "drizzle-orm";
import {cases,caseSources} from "../backend/schema";
import {citeCaseSource} from "../backend/source-service";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Disposable branch required");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:3}),db=drizzle(pool),caseId=randomUUID(),identity={id:randomUUID(),case_id:caseId,owner_id:randomUUID()};
const quote="A short exact quotation from a synthetic public source.";
const source={requested_url:"https://example.com/",url:"https://example.com/",title:"Example",text:quote,quote,sha256:createHash("sha256").update(quote).digest("hex"),retrieved_at:new Date().toISOString()};
const input={operation_id:randomUUID(),url:source.url,quote};let reads=0;const fetcher=async()=>{reads++;return source;};
before(async()=>{await migrate(db,{migrationsFolder:"drizzle"});await db.insert(cases).values({id:caseId,owner_id:identity.owner_id,title:"Synthetic citation"});});
after(async()=>{await db.delete(caseSources).where(eq(caseSources.case_id,caseId));await db.delete(cases).where(eq(cases.id,caseId));await pool.end();});
test("concurrent citation retries store one snapshot and advance one revision",async()=>{
 const [a,b]=await Promise.all([citeCaseSource(db,identity,input,fetcher),citeCaseSource(db,identity,input,fetcher)]);assert.equal(a.id,b.id);assert.equal("text" in a,false);assert.match(a.evidence_ref,/^source:/);
 assert.equal((await db.select().from(cases).where(eq(cases.id,caseId)))[0].revision,2);
 const before=reads;await citeCaseSource(db,identity,input,fetcher);assert.equal(reads,before);
});
test("owner isolation and changed operation rejection happen before network reads",async()=>{
 const before=reads;await assert.rejects(()=>citeCaseSource(db,{...identity,owner_id:"wrong"},input,fetcher),/NOT_FOUND/);await assert.rejects(()=>citeCaseSource(db,identity,{...input,url:"https://other.example/"},fetcher),/OPERATION_CONFLICT/);assert.equal(reads,before);
 await assert.rejects(()=>citeCaseSource(db,identity,{...input,operation_id:randomUUID()},fetcher),/SOURCE_ALREADY_SAVED/);
});
