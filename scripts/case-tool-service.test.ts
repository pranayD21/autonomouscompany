import {test,after,before} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq,inArray} from "drizzle-orm";
import {cases,caseToolCredentials,caseAgentFacts} from "../backend/schema";
import {issueCaseToolCredential,resolveCaseToolCredential} from "../backend/case-tool-auth";
import {caseToolServices} from "../backend/case-tool-service";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Use a disposable branch");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:4}),db=drizzle(pool),ids:string[]=[];
const owner=`case-tools-${randomUUID()}`;process.env.CREW_ALLOWED_USER_IDS=owner;
before(async()=>{await migrate(db,{migrationsFolder:"drizzle"});});
after(async()=>{if(ids.length){await db.delete(caseAgentFacts).where(inArray(caseAgentFacts.case_id,ids));await db.delete(caseToolCredentials).where(inArray(caseToolCredentials.case_id,ids));await db.delete(cases).where(inArray(cases.id,ids));}await pool.end();});
async function fixture(){const[item]=await db.insert(cases).values({owner_id:owner,title:"Synthetic MCP case"}).returning();ids.push(item.id);return item;}
test("credential is owner-scoped, hash-only, expiring and revocable",async()=>{
 const item=await fixture();await assert.rejects(()=>issueCaseToolCredential(db,item.id,"other"),/NOT_FOUND/);
 const issued=await issueCaseToolCredential(db,item.id,owner),saved=(await db.select().from(caseToolCredentials).where(eq(caseToolCredentials.id,issued.id)))[0];
 assert.notEqual(saved.token_hash,issued.token);assert.equal(saved.token_hash.length,64);assert.equal((await resolveCaseToolCredential(db,issued.token))?.case_id,item.id);assert.equal(await resolveCaseToolCredential(db,"wrong"),null);
 await db.update(caseToolCredentials).set({expires_at:new Date(0)}).where(eq(caseToolCredentials.id,issued.id));assert.equal(await resolveCaseToolCredential(db,issued.token),null);
 await db.update(caseToolCredentials).set({expires_at:new Date(Date.now()+60000),revoked_at:new Date()}).where(eq(caseToolCredentials.id,issued.id));assert.equal(await resolveCaseToolCredential(db,issued.token),null);
});
test("concurrent fact retries write once; unknown sources and changed operations reject",async()=>{
 const item=await fixture(),issued=await issueCaseToolCredential(db,item.id,owner),identity=(await resolveCaseToolCredential(db,issued.token))!,service=caseToolServices(db);
 const input={operation_id:randomUUID(),statement:"Fictional case statement",source_ref:"case:1"};const[a,b]=await Promise.all([service.recordFact(identity,input),service.recordFact(identity,input)]);assert.deepEqual(a,b);
 assert.equal((await db.select().from(caseAgentFacts).where(eq(caseAgentFacts.case_id,item.id))).length,1);assert.equal((await db.select().from(cases).where(eq(cases.id,item.id)))[0].revision,2);
 await assert.rejects(()=>service.recordFact(identity,{...input,statement:"Changed"}),/OPERATION_CONFLICT/);
 await assert.rejects(()=>service.recordFact(identity,{...input,operation_id:randomUUID(),source_ref:"document:invented"}),/UNKNOWN_EVIDENCE/);
});
