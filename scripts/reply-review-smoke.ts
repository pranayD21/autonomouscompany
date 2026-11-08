import {chromium,expect} from "@playwright/test";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {config} from "dotenv";
import {Pool} from "pg";
config({path:".env.local",quiet:true});
const action=JSON.parse(readFileSync("test-results/email-dispatch-result.json","utf8"));const file="test-results/reply-review-run.json";const run=existsSync(file)?JSON.parse(readFileSync(file,"utf8")):{caseId:action.case_id};const save=()=>writeFileSync(file,JSON.stringify(run),{mode:0o600});save();
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:1});const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({storageState:"test-results/crew-app-browser.json"});const page=await context.newPage();let token="",base="";
 page.on("request",r=>{if(r.url().endsWith("/stack/status")){token=r.headers().authorization;base=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
 const headers={Authorization:token,"Content-Type":"application/json"};const request=(path:string,method="GET")=>fetch(base+path,{method,headers,signal:AbortSignal.timeout(60000)});
 const replies=await(await request(`/cases/${run.caseId}/replies`)).json();expect(replies.replies.some((r:any)=>r.disposition==="accepted")).toBe(true);
 if(!run.sessionId){let enabled=false;for(let n=0;n<20;n++){const status=await(await request("/stack/status")).json();if(status.naive.enabledForUser){enabled=true;break;}await new Promise(r=>setTimeout(r,2000));}expect(enabled).toBe(true);const started=await request(`/cases/${run.caseId}/crew`,"POST");const result=await started.json();if(!started.ok)throw Error(`Review start HTTP ${started.status}: ${result.error??result.code??"unavailable"}`);run.sessionId=result.session_id;save();}
 const {rows:[record]}=await pool.query("SELECT message,case_revision FROM advocacy_crew_runs WHERE session_id=$1",[run.sessionId]);const input=JSON.parse(record.message);expect(input.correspondence.replies.length).toBeGreaterThan(0);expect(input.correspondence.replies.every((r:any)=>replies.replies.some((s:any)=>s.id===r.reply_id&&s.sha256===r.sha256&&s.disposition==="accepted"))).toBe(true);
 console.log("PASS actual received email captured as immutable, source-linked correspondence in the new case revision");
 const initial=await(await request(`/cases/${run.caseId}/crew`)).json();
 if(!initial.saved_at&&initial.status==="idle"&&initial.stop_reason==="end_turn"&&!initial.repair_sent_at){
  const correction=await request(`/cases/${run.caseId}/crew/repair`,"POST");expect(correction.ok).toBe(true);console.log("Correction requested in the same reply-review session");
 }
 let final:any;for(let n=0;n<60;n++){const response=await request(`/cases/${run.caseId}/crew`);expect(response.ok).toBe(true);final=await response.json();if(final.saved_at)break;if(final.status==="idle"&&final.stop_reason==="end_turn")throw Error("Reply review rejected by validation; preserve the session for inspection");if(final.stop_reason==="error")throw Error("Reply review provider error; preserve session");console.log(`Reply review: ${final.status}/${final.stop_reason??"running"}`);await new Promise(r=>setTimeout(r,5000));}
 if(!final?.saved_at){console.log("PENDING existing reply-review session; do not start a replacement");process.exitCode=2;}
 else{
  expect(final.result.reply_references.length).toBeGreaterThan(0);const expected=input.case.bill_cents===null||input.case.eob_cents===null?null:Math.max(0,input.case.bill_cents-input.case.eob_cents);expect(final.result.potential_discrepancy_cents).toBe(expected);
  await page.reload();const card=page.locator(`[data-case-id="${run.caseId}"]`);await expect(card.getByText("Review saved to your case.")).toBeVisible({timeout:20000});const link=card.getByRole("link",{name:"View reply 1",exact:true});await expect(link).toBeVisible();const href=await link.getAttribute("href");await expect(page.locator(href!)).toBeVisible();
  writeFileSync("test-results/reply-review-result.json",JSON.stringify(final),{mode:0o600});console.log("PASS completed correspondence-aware review, exact reply reference, unchanged potential discrepancy, and persistent UI source link");
 }
}finally{await browser.close();await pool.end();}
