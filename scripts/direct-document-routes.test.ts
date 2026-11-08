import {caseToolServices} from "../backend/case-tool-service";
import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {Hono} from "hono";
import {extractionRoutes} from "../backend/document-extraction-routes";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Disposable database required");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full")});
const owner=randomUUID(),ids:string[]=[],bytes=new Uint8Array([1,2,3]),sha=createHash("sha256").update(bytes).digest("hex");
const result={visible_text:"Fictional evidence",insurer_name:null,member_name:null,member_id:null,group_number:null,claim_number:null,uncertainties:[]};
before(async()=>{await migrate(drizzle(pool),{migrationsFolder:"drizzle"});process.env.ASSURANCE_DOCUMENT_READER="direct_openai";process.env.OPENAI_API_KEY="test-only";});
after(async()=>{for(const id of ids){await pool.query("DELETE FROM advocacy_document_extractions WHERE document_id IN(SELECT id FROM advocacy_documents WHERE case_id=$1)",[id]);await pool.query("DELETE FROM advocacy_documents WHERE case_id=$1",[id]);await pool.query("DELETE FROM advocacy_cases WHERE id=$1",[id]);}await pool.end();});
async function fixture(hash=sha){const caseId=randomUUID(),docId=randomUUID();ids.push(caseId);await pool.query("INSERT INTO advocacy_cases(id,owner_id,title) VALUES($1,$2,'Reader fixture')",[caseId,owner]);await pool.query("INSERT INTO advocacy_documents(id,case_id,object_key,filename,mime,byte_size,sha256,kind,state) VALUES($1,$2,$3,'fiction.png','image/png',3,$4,'insurance_card','ready')",[docId,caseId,docId,hash]);return {caseId,docId};}
function app(read:()=>Promise<typeof result>){const app=new Hono<{Variables:{userId:string}}>();app.use("*",async(c,next)=>{c.set("userId",c.req.header("x-owner")??owner);await next();});app.route("/cases/:id/documents/:documentId/extraction",extractionRoutes(pool,{download:async()=>bytes,read}));return app;}
const request=(a:ReturnType<typeof app>,f:{caseId:string;docId:string},suffix="",user=owner)=>a.request(`/cases/${f.caseId}/documents/${f.docId}/extraction${suffix}`,{method:"POST",headers:{"content-type":"application/json","x-owner":user},body:JSON.stringify({confirm:true})});
test("concurrent direct starts read once and confirmation changes revision exactly once",async()=>{
 const f=await fixture();let calls=0,release!:()=>void,started!:()=>void;const begun=new Promise<void>(r=>started=r),held=new Promise<void>(r=>release=r);
 const a=app(async()=>{calls++;started();await held;return result;});const first=request(a,f);await begun;
 assert.equal((await(await request(a,f)).json()).state,"direct_running");assert.equal(calls,1);release();assert.equal((await(await first).json()).state,"ready");
 assert.equal((await pool.query("SELECT revision FROM advocacy_cases WHERE id=$1",[f.caseId])).rows[0].revision,2);
 const context=await caseToolServices(drizzle(pool)).getCase({id:randomUUID(),case_id:f.caseId,owner_id:owner});
 assert.equal((context as any).transcriptions[0].trust,"machine_extracted_unverified");
 assert.equal((context as any).transcriptions[0].confirmed_at,null);
 assert.equal((await request(a,f,"/confirm",randomUUID())).status,404);
 await Promise.all([request(a,f,"/confirm"),request(a,f,"/confirm")]);
 assert.equal((await pool.query("SELECT revision FROM advocacy_cases WHERE id=$1",[f.caseId])).rows[0].revision,3);
});
test("stale direct attempt is fenced against a later successful retry",async()=>{
 const f=await fixture();let calls=0,release!:()=>void,started!:()=>void;const begun=new Promise<void>(r=>started=r),held=new Promise<void>(r=>release=r);
 const a=app(async()=>{if(++calls===1){started();await held;return {...result,visible_text:"old"};}return {...result,visible_text:"new"};});const first=request(a,f);await begun;
 await pool.query("UPDATE advocacy_document_extractions SET created_at=now()-interval '3 minutes' WHERE document_id=$1",[f.docId]);
 assert.equal((await(await request(a,f)).json()).result.visible_text,"new");release();await first;
 assert.equal((await pool.query("SELECT result FROM advocacy_document_extractions WHERE document_id=$1",[f.docId])).rows[0].result.visible_text,"new");
});
test("hash mismatch prevents inference; provider failure stays unconfirmed and retryable",async()=>{
 const bad=await fixture("a".repeat(64));let calls=0;const a=app(async()=>{calls++;throw Error("DIRECT_READER_HTTP_429");});
 assert.equal((await(await request(a,bad)).json()).code,"DOCUMENT_HASH_MISMATCH");assert.equal(calls,0);
 const f=await fixture();assert.equal((await(await request(a,f)).json()).code,"DIRECT_READER_HTTP_429");assert.equal((await request(a,f,"/confirm")).status,409);
 assert.equal((await(await request(app(async()=>result),f)).json()).state,"ready");
 assert.equal((await pool.query("SELECT confirmed_at FROM advocacy_document_extractions WHERE document_id=$1",[f.docId])).rows[0].confirmed_at,null);
});
