import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { config } from "dotenv";
config({path:[".env.local",".env"],quiet:true});
mkdirSync("test-results",{recursive:true});
const record="test-results/crew-app.json";
const state="test-results/crew-app-browser.json";
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext(existsSync(state)?{storageState:state}:{});
 const page=await context.newPage();
 let token="", apiBase="";
 page.on("request",r=>{if(r.url().includes("-cases.compute.")&&r.headers().authorization) {token=r.headers().authorization;apiBase=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");
 if(process.argv.includes("--prepare")) {
  if(existsSync(record)) throw new Error("Test identity already prepared; reuse it.");
  await page.getByRole("button",{name:"New here? Create an account"}).click();
  await page.getByLabel("Name",{exact:true}).fill("Synthetic crew operator");
  await page.getByLabel("Email",{exact:true}).fill(`crew-${randomUUID()}@example.com`);
  await page.getByLabel("Password",{exact:true}).fill(randomUUID()+"aA1!");
  await page.getByRole("button",{name:"Create account",exact:true}).click();
  await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
  const r=await fetch(`${apiBase}/session`,{headers:{Authorization:token}});
  expect(r.status).toBe(200);
  const {userId}=await r.json();
  await context.storageState({path:state});chmodSync(state,0o600);
  writeFileSync(record,JSON.stringify({userId,title:`Synthetic crew workflow ${randomUUID()}`}),{mode:0o600});
  console.log("PASS synthetic operator created; add its ID to the test allowlist for this check");
 } else {
  const run=JSON.parse(readFileSync(record,"utf8"));
  await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
  if(!run.caseId) {
   await page.getByLabel("Case type",{exact:true}).selectOption("health_insurance");
  await page.getByLabel("Case title").fill(run.title);
   await page.getByLabel("Bill amount ($)").fill("1200");
   await page.getByLabel("EOB responsibility ($)").fill("400");
   await page.getByLabel("Case notes").fill("Synthetic test. No itemized bill, payer adjustments or payment records provided. No external actions authorized.");
   await page.getByRole("button",{name:"Save case"}).click();
   const card=page.locator("article").filter({hasText:run.title});
   await expect(card).toBeVisible({timeout:20000});
   run.caseId=await card.getAttribute("data-case-id");
   writeFileSync(record,JSON.stringify(run),{mode:0o600});
  }
  const card=page.locator("article").filter({hasText:run.title});
  const path=`${apiBase}/cases/${run.caseId}/crew`;
  if(!run.started) {
   await expect(card.getByRole("button",{name:"Run agent team"})).toBeEnabled({timeout:15000});
   await card.getByRole("button",{name:"Run agent team"}).click();
   await expect(card.getByText(/Status:/)).toBeVisible({timeout:45000});
   run.started=true;writeFileSync(record,JSON.stringify(run),{mode:0o600});
  }
  const headers={Authorization:token};
  const duplicate=await Promise.all([fetch(path,{method:"POST",headers}),fetch(path,{method:"POST",headers})]);
  expect(duplicate.every(r=>r.ok)).toBe(true);
  const sessions=await Promise.all(duplicate.map(r=>r.json()));
  expect(sessions[0].session_id).toBe(sessions[1].session_id);
  console.log("PASS repeated start requests return the same provider session");
  let final:any;
  for(let n=0;n<30;n++) {
   const r=await fetch(path,{headers});expect(r.status).toBe(200);final=await r.json();
   if(final.saved_at) break;
   if(["error","budget_paused"].includes(final.stop_reason)) throw new Error(`Crew stopped: ${final.stop_reason}`);
   console.log(`Crew pending: ${final.status}/${final.stop_reason??"running"}`);
   await new Promise(resolve=>setTimeout(resolve,10000));
  }
  expect(final.saved_at).toBeTruthy();expect(final.output_valid).toBe(true);
  expect(final.result.potential_discrepancy_cents).toBe(80000);
  await card.getByRole("button",{name:"Refresh team status"}).click();
  await expect(card.getByText("Review saved to your case.")).toBeVisible({timeout:20000});
  await page.reload();
  await expect(card.getByText("Review saved to your case.")).toBeVisible({timeout:20000});
  await expect(card.getByRole("button",{name:"Run agent team"})).toBeDisabled();
  const reread=await fetch(path,{headers});expect(await reread.json()).toEqual(final);
  console.log("PASS deployed Auth → case → Naïve → durable review → UI reload; saved snapshot is stable");
  writeFileSync("test-results/crew-app-result.json",JSON.stringify({caseId:run.caseId,sessionId:sessions[0].session_id,...final}),{mode:0o600});
 }
} finally {await browser.close();}
