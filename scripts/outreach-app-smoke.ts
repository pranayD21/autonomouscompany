import {chromium,expect} from "@playwright/test";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {randomUUID} from "node:crypto";
const run=JSON.parse(readFileSync("test-results/crew-app.json","utf8"));
const record="test-results/outreach-app.json";
const test=existsSync(record)?JSON.parse(readFileSync(record,"utf8")):{id:randomUUID()};
writeFileSync(record,JSON.stringify(test),{mode:0o600});
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({storageState:"test-results/crew-app-browser.json"});const page=await context.newPage();
 let token="",base="";page.on("request",r=>{if(r.url().endsWith("/stack/status")){token=r.headers().authorization;base=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");
 await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:30000});
 const card=page.locator("article").filter({hasText:run.title});
 await expect(card.getByText("Review saved to your case.")).toBeVisible({timeout:20000});
 const headers={Authorization:token,"Content-Type":"application/json"};
 const path=`${base}/cases/${run.caseId}/actions`;
 let ready=false;
 for(let n=0;n<20;n++) {const r=await fetch(path,{headers});if(r.ok){ready=true;break}console.log("Waiting for outreach routes to serve");await new Promise(r=>setTimeout(r,10000));}
 expect(ready).toBe(true);
 const draft={id:test.id,kind:"email",destination:"synthetic@example.com",subject:"Synthetic outreach workflow test",body:"This is a synthetic test draft. No real patient information. No send is authorized.",synthetic:true};
 for(let n=0;n<2;n++){const r=await fetch(path,{method:"POST",headers,body:JSON.stringify(draft)});expect(r.status).toBe(201);expect((await r.json()).id).toBe(test.id);}
 const conflict=await fetch(path,{method:"POST",headers,body:JSON.stringify({...draft,body:"Different draft content"})});expect(conflict.status).toBe(409);
 const blocked=await fetch(`${path}/${test.id}/authorize`,{method:"POST",headers,body:JSON.stringify({authorize:true,synthetic:true})});expect(blocked.status).toBe(403);
 const uncertain=await fetch(`${path}/${test.id}/refresh`,{method:"POST",headers});expect(uncertain.status).toBe(409);
 await page.reload();const row=card.locator(`[data-action-id="${test.id}"]`);await expect(row.getByText("Status: draft",{exact:true})).toBeVisible({timeout:20000});
 await expect(row.getByRole("button",{name:"Review and authorize email"})).toBeDisabled();
 const rows=await(await fetch(path,{headers})).json();expect(rows.filter((a:{id:string})=>a.id===test.id)).toHaveLength(1);
 const uiSubject=`UI synthetic draft ${test.id}`;
 if(!rows.some((a:{subject:string})=>a.subject===uiSubject)) {
  await card.getByLabel("Recipient email",{exact:true}).fill("synthetic@example.com");
  await card.getByLabel("Subject or call purpose",{exact:true}).fill(uiSubject);
  await card.getByLabel("Email text",{exact:true}).fill("Synthetic UI test only. Do not send this draft.");
  await card.getByRole("button",{name:"Save outreach draft"}).click();
 }
 await expect(card.getByRole("heading",{name:`Email: ${uiSubject}`,exact:true})).toBeVisible({timeout:15000});
 console.log("PASS owner draft persistence, immutable request replay, duplicate prevention, operator denial, and UI draft form");
 const other=await browser.newContext();const p=await other.newPage();let otherToken="";
 p.on("request",r=>{if(r.url().includes("-cases.compute.")&&r.headers().authorization)otherToken=r.headers().authorization;});
 await p.goto("http://localhost:4173");await p.getByRole("button",{name:"New here? Create an account"}).click();
 await p.getByLabel("Name",{exact:true}).fill("Synthetic unrelated user");await p.getByLabel("Email",{exact:true}).fill(`outreach-${randomUUID()}@example.com`);await p.getByLabel("Password",{exact:true}).fill(randomUUID()+"Aa1!");await p.getByRole("button",{name:"Create account",exact:true}).click();await expect(p.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:30000});
 const otherHeaders={Authorization:otherToken,"Content-Type":"application/json"};
 for(const [suffix,method] of [["","GET"],["","POST"],[`/${test.id}/authorize`,"POST"],[`/${test.id}/refresh`,"POST"]]) {
  const r=await fetch(path+suffix,{method,headers:otherHeaders,...method==="POST"?{body:JSON.stringify(draft)}:{}});expect(r.status).toBe(404);
 }
 console.log("PASS second user cannot read, draft, authorize, or refresh another user's outreach");
} finally {await browser.close();}
