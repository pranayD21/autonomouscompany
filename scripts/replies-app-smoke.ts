import {chromium,expect} from "@playwright/test";
import {readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
const action=JSON.parse(readFileSync("test-results/email-dispatch-result.json","utf8"));
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({storageState:"test-results/crew-app-browser.json"});const page=await context.newPage();let token="",base="";
 page.on("request",r=>{if(r.url().endsWith("/stack/status")){token=r.headers().authorization;base=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
 const headers={Authorization:token};const path=`${base}/cases/${action.case_id}`;
 let ready=false;for(let n=0;n<20;n++){const r=await fetch(`${path}/replies`,{headers});if(r.ok){ready=true;break;}await new Promise(r=>setTimeout(r,2000));}expect(ready).toBe(true);
 await page.reload();const card=page.locator(`[data-case-id="${action.case_id}"]`);const row=card.locator(`[data-action-id="${action.id}"]`);
 const responsePromise=page.waitForResponse(r=>r.url().endsWith(`/actions/${action.id}/replies/sync`)&&r.request().method()==="POST",{timeout:45000});
 await row.getByRole("button",{name:"Check replies",exact:true}).click();const response=await responsePromise;expect(response.ok()).toBe(true);const first=await response.json();
 const initial=await(await fetch(`${path}/replies`,{headers})).json();
 const again=await fetch(`${path}/actions/${action.id}/replies/sync`,{method:"POST",headers});expect(again.ok).toBe(true);const second=await again.json();
 const saved=await(await fetch(`${path}/replies`,{headers})).json();expect(new Set(saved.replies.map((r:any)=>r.message_id)).size).toBe(saved.replies.length);
 if(saved.replies.length===initial.replies.length){expect(second.imported).toBe(0);expect(second.changed).toBe(0);}
 await page.reload();await expect(card.getByRole("heading",{name:"Received correspondence",exact:true})).toBeVisible({timeout:20000});await expect(row.getByRole("button",{name:"Check replies",exact:true})).toBeVisible();
 for(const reply of saved.replies){await expect(page.locator(`#reply-${reply.id}`)).toBeVisible();}
 writeFileSync("test-results/replies-app-result.json",JSON.stringify({first,second,reply_count:saved.replies.length,accepted:saved.replies.filter((r:any)=>r.disposition==="accepted").length}),{mode:0o600});
 console.log(`PASS live AgentMail thread sync through UI, durable listing, and duplicate protection; received replies=${saved.replies.length}`);
 const other=await browser.newContext();const p=await other.newPage();let otherToken="";
 p.on("request",r=>{if(r.url().endsWith("/stack/status"))otherToken=r.headers().authorization;});
 await p.goto("http://localhost:4173");await p.getByRole("button",{name:"New here? Create an account"}).click();await p.getByLabel("Name",{exact:true}).fill("Synthetic reply isolation");await p.getByLabel("Email",{exact:true}).fill(`reply-${randomUUID()}@example.com`);await p.getByLabel("Password",{exact:true}).fill(randomUUID()+"Aa1!");await p.getByRole("button",{name:"Create account",exact:true}).click();await expect(p.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
 for(const [url,method]of [[`${path}/replies`,"GET"],[`${path}/actions/${action.id}/replies/sync`,"POST"]]){const r=await fetch(url,{method,headers:{Authorization:otherToken}});expect(r.status).toBe(404);}
 const anonymous=await fetch(`${path}/replies`);expect(anonymous.status).toBe(401);
 console.log("PASS missing authentication and cross-user reply read/sync denied");
 if(!saved.replies.length)console.log("PENDING real inbound reply: provider thread contains only the previously sent test email");
}finally{await browser.close();}
