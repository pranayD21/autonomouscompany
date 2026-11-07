import {chromium,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
const run=JSON.parse(readFileSync("test-results/document-reader-app.json","utf8"));
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({storageState:"test-results/crew-app-browser.json"});const page=await context.newPage();let token="",base="";
 page.on("request",r=>{if(r.url().endsWith("/stack/status")){token=r.headers().authorization;base=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});await expect(page).toHaveTitle("Assurance");
 const headers={Authorization:token};let disabled=false;
 for(let i=0;i<15;i++){const status=await(await fetch(`${base}/stack/status`,{headers})).json();if(!status.naive.enabledForUser){disabled=true;break;}await new Promise(r=>setTimeout(r,2000));}
 expect(disabled).toBe(true);
 for(const path of [`/cases/${run.caseId}/crew`,`/cases/${run.caseId}/documents/${run.imageId}/extraction`]){const r=await fetch(base+path,{method:"POST",headers});console.log(`${path.endsWith("/crew")?"Crew":"Document reader"} spending gate: ${r.status}; redirected=${r.redirected}; keys=${Object.keys(await r.clone().json()).join(",")}`);expect(r.status).toBe(403);}
 const card=page.locator("article").filter({hasText:run.title});await expect(card.getByText("Review saved to your case.")).toBeVisible({timeout:20000});await expect(card.getByRole("link",{name:"View source document 1"})).toBeVisible();
 const href=await card.getByRole("link",{name:"View source document 1"}).getAttribute("href");expect(href).toMatch(/^#document-/);await expect(page.locator(href!)).toHaveCount(1);
 console.log("PASS Assurance title, persisted source-linked review, and restored 403 crew/document spending gates");
}finally{await browser.close();}
