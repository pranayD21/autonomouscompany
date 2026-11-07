import {chromium,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
const file="test-results/injury-app.json";
const run=existsSync(file)?JSON.parse(readFileSync(file,"utf8")):{title:`Synthetic workplace burn ${randomUUID()}`,draftId:randomUUID()};
const save=()=>writeFileSync(file,JSON.stringify(run),{mode:0o600});save();
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({storageState:"test-results/crew-app-browser.json"});const page=await context.newPage();let token="",base="";
 page.on("request",r=>{if(r.url().endsWith("/stack/status")){token=r.headers().authorization;base=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
 const headers={Authorization:token,"Content-Type":"application/json"};
 let ready=false;for(let n=0;n<20;n++){const r=await fetch(`${base}/stack/status`,{headers,signal:AbortSignal.timeout(15000)});if((await r.json()).naive.enabledForUser){ready=true;break}console.log("Waiting for test operator deployment");await new Promise(r=>setTimeout(r,10000));}expect(ready).toBe(true);
 if(!run.caseId){
  await page.reload();await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:30000});
  await page.getByLabel("Case title",{exact:true}).fill(run.title);await page.getByLabel("Contact name",{exact:true}).fill("Synthetic injured worker");await page.getByLabel("Contact email",{exact:true}).fill("worker@example.com");await page.getByLabel("What happened?",{exact:true}).fill("Synthetic demo: a chemical splash caused a burn at a pharmaceutical office. Employer insurance, treatment records, and claim details are not yet known. No insurer contact or claim submission has occurred.");
  await page.getByRole("button",{name:"Save case",exact:true}).click();const card=page.locator("article").filter({hasText:run.title});await expect(card).toBeVisible({timeout:20000});run.caseId=await card.getAttribute("data-case-id");save();
 }
 const card=page.locator("article").filter({hasText:run.title});const path=`${base}/cases/${run.caseId}`;
 const all=await(await fetch(`${base}/cases`,{headers})).json();const original=all.find((x:{id:string})=>x.id===run.caseId);expect(original.bill_cents).toBe(null);expect(original.eob_cents).toBe(null);expect(original.case_type).toBe("workplace_injury");
 await expect(card.getByText(/Financial outcome unknown/)).toBeVisible();console.log("PASS injury-first intake stores unknown amounts as null");
 if(!run.updated){
 if(!run.sessionId){const r=await fetch(`${path}/crew`,{method:"POST",headers,signal:AbortSignal.timeout(45000)});expect(r.ok).toBe(true);run.sessionId=(await r.json()).session_id;save();}
 let final:any;
 for(let n=0;n<35;n++){const r=await fetch(`${path}/crew`,{headers,signal:AbortSignal.timeout(35000)});expect(r.status).toBe(200);final=await r.json();if(final.saved_at)break;if(final.stop_reason==="error")throw new Error("Crew failed; retain this case/run for inspection");console.log(`Injury crew: ${final.status}/${final.stop_reason??"running"}`);await new Promise(r=>setTimeout(r,10000));}
 expect(final.saved_at).toBeTruthy();expect(final.result.potential_discrepancy_cents).toBe(null);expect(final.result.missing_information.length).toBeGreaterThan(0);expect(final.result.human_help_required).toBe(true);
 await page.reload();await expect(card.getByText("Review saved to your case.")).toBeVisible({timeout:20000});
 writeFileSync("test-results/injury-review.json",JSON.stringify(final),{mode:0o600});console.log("PASS live injury crew saved a plan without fabricated financial amounts");
 if(!run.updated){
  const draft={id:run.draftId,kind:"email",destination:"synthetic@example.com",subject:"Synthetic insurer inquiry",body:"Synthetic draft only. Request employer insurer identification. No send authorized.",synthetic:true};
  const d=await fetch(`${path}/actions`,{method:"POST",headers,body:JSON.stringify(draft)});expect(d.status).toBe(201);
  await card.getByRole("button",{name:"Update case details"}).click();await card.getByLabel("Employer name",{exact:true}).fill("Fictional Pharma Office");await card.getByLabel("State or jurisdiction",{exact:true}).fill("California");await card.getByRole("button",{name:"Save updated details"}).click();
  await expect(card.getByText("Employer: Fictional Pharma Office",{exact:true})).toBeVisible({timeout:20000});run.updated=true;save();
  const conflict=await fetch(path,{method:"PATCH",headers,body:JSON.stringify({...original,revision:original.revision})});expect(conflict.status).toBe(409);
 }
 }
 const currentCrew=await(await fetch(`${path}/crew`,{headers})).json();expect(currentCrew.status).toBe("not_started");
 const stale=await fetch(`${path}/actions/${run.draftId}/authorize`,{method:"POST",headers,body:JSON.stringify({authorize:true,synthetic:true})});expect(stale.status).toBe(409);
 await page.reload();await expect(card.getByText("Employer: Fictional Pharma Office",{exact:true})).toBeVisible({timeout:20000});await expect(card.getByText("Review saved to your case.")).toHaveCount(0);
 console.log("PASS progressive edit persists, stale edit conflicts, old review is not reused, and stale outreach cannot dispatch");
}finally{await browser.close();}
