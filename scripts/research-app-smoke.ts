import {chromium,expect} from "@playwright/test";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {config} from "dotenv";
import {Pool} from "pg";
import {researchFindingsValid} from "../backend/research";
config({path:".env.local",quiet:true});
const prior=JSON.parse(readFileSync("test-results/document-reader-app.json","utf8"));
const file="test-results/research-app.json";const run=existsSync(file)?JSON.parse(readFileSync(file,"utf8")):{caseId:prior.caseId,title:prior.title};
const save=()=>writeFileSync(file,JSON.stringify(run),{mode:0o600});save();
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:1});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({storageState:"test-results/crew-app-browser.json"});const page=await context.newPage();let token="",base="";
 page.on("request",r=>{if(r.url().endsWith("/stack/status")){token=r.headers().authorization;base=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
 const headers={Authorization:token,"Content-Type":"application/json"};const request=(path:string,method="GET",body?:unknown)=>fetch(base+path,{method,headers,...body===undefined?{}:{body:JSON.stringify(body)},signal:AbortSignal.timeout(60000)});
 let status=await(await request("/stack/status")).json();if(!run.sessionId)expect(status.naive.enabledForUser).toBe(true);
 if(!run.revision){
  const all=await(await request("/cases")).json();const item=all.find((x:any)=>x.id===run.caseId);
  const updated=await request(`/cases/${run.caseId}`,"PATCH",{...item,revision:item.revision,notes:"Synthetic Assurance source-backed research test. Both uploaded records are fictional. No external contact or claim submission is authorized."});expect(updated.ok).toBe(true);run.revision=(await updated.json()).revision;save();
 }
 if(!run.sessionId){const r=await request(`/cases/${run.caseId}/crew`,"POST");expect(r.ok).toBe(true);run.sessionId=(await r.json()).session_id;save();}
 const {rows:[record]}=await pool.query("SELECT message FROM advocacy_crew_runs WHERE session_id=$1",[run.sessionId]);const input=JSON.parse(record.message);
 expect(input.research.status).toBe("ready");expect(input.research.sources.length).toBe(2);expect(input.documents.filter((d:any)=>d.result&&d.confirmed_at).length).toBe(2);
 if(status.naive.enabledForUser){const repeated=await request(`/cases/${run.caseId}/crew`,"POST");expect((await repeated.json()).session_id).toBe(run.sessionId);}
 const {rows:[after]}=await pool.query("SELECT message FROM advocacy_crew_runs WHERE session_id=$1",[run.sessionId]);expect(after.message).toBe(record.message);
 console.log("PASS deployed source retrieval, confirmed documents, immutable research snapshot, and preserved session");
 const initial=await(await request(`/cases/${run.caseId}/crew`)).json();
 if(!initial.saved_at&&initial.status==="idle"&&initial.stop_reason==="end_turn"&&!initial.repair_sent_at){
  for(let i=0;i<20&&!status.naive.enabledForUser;i++){await new Promise(r=>setTimeout(r,2000));status=await(await request("/stack/status")).json();}
  expect(status.naive.enabledForUser).toBe(true);
  await page.reload();const card=page.locator("article").filter({hasText:run.title});
  await card.getByRole("button",{name:"Correct rejected review",exact:true}).click();
  await expect(card.getByRole("button",{name:"Correct rejected review",exact:true})).toHaveCount(0,{timeout:45000});
  const {rows:[first]}=await pool.query("SELECT repair_sent_at,session_id FROM advocacy_crew_runs WHERE session_id=$1",[run.sessionId]);expect(first.repair_sent_at).toBeTruthy();
  const again=await request(`/cases/${run.caseId}/crew/repair`,"POST");expect([200,409]).toContain(again.status);
  const {rows:[second]}=await pool.query("SELECT repair_sent_at,session_id FROM advocacy_crew_runs WHERE session_id=$1",[run.sessionId]);expect(second).toEqual(first);
  console.log("PASS one UI-triggered correction in the same session; repeated request does not change the correction record");
 }
 let final:any;
 for(let n=0;n<60;n++){
  const r=await request(`/cases/${run.caseId}/crew`);expect(r.ok).toBe(true);final=await r.json();if(final.saved_at)break;
  if(final.stop_reason==="error")throw Error("Provider error; preserve this run for inspection");
  if(final.status==="idle"&&final.stop_reason==="end_turn")throw Error("Completed provider output failed evidence validation; preserve this run");
  console.log(`Research crew: ${final.status}/${final.stop_reason??"running"}`);await new Promise(r=>setTimeout(r,5000));
 }
 if(!final?.saved_at){console.log("PENDING existing research session remains unfinished; do not restart it");process.exitCode=2;}
 else{
  expect(final.result.potential_discrepancy_cents).toBe(null);expect(final.result.document_references.length).toBeGreaterThan(0);expect(researchFindingsValid(final.result.research_findings,input.research)).toBe(true);
  const followup=final.result.next_questions??final.result.next_actions;expect(followup.length).toBeGreaterThan(0);expect(followup.length).toBeLessThanOrEqual(3);expect(followup.join(" ")).toMatch(/synthetic|fictional|demo/i);expect(followup.join(" ")).not.toMatch(/(?:real|actual|valid current) (?:insurance card|member|medical record|personal)/i);
  expect(final.result.summary).not.toMatch(/(?:workers.? compensation|health insurance).{0,40}(?:typically|generally|is) primary/i);
  await page.reload();const card=page.locator("article").filter({hasText:run.title});await expect(card.getByText("Review saved to your case.")).toBeVisible({timeout:20000});await expect(card.getByRole("heading",{name:"Official guidance consulted"})).toBeVisible();await expect(card.getByRole("heading",{name:"Guidance and applicability"})).toBeVisible();
  const links=await card.locator('a[href="https://www.dir.ca.gov/DWC/FileAClaim.htm"]').count();expect(links).toBeGreaterThan(0);
  writeFileSync("test-results/research-review.json",JSON.stringify(final),{mode:0o600});
  console.log("PASS completed source-linked review, exact quotes, null financial outcome, progressive synthetic questions, and persisted official links");
 }
}finally{await browser.close();await pool.end();}
