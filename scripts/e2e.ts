import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const browser = await chromium.launch({headless:true});
const context = await browser.newContext();
const page = await context.newPage();
let authorization="", apiBase="";
page.on("request", request=>{if(request.url().includes("-cases.compute.")&&request.headers().authorization){authorization=request.headers().authorization;apiBase=new URL(request.url()).origin;}});
try {
  await page.goto("http://localhost:4173");
  await page.getByRole("button", {name:"New here? Create an account"}).click();
  await page.getByLabel("Name", {exact:true}).fill("Synthetic stack test");
  await page.getByLabel("Email", {exact:true}).fill(`stack-${randomUUID()}@example.com`);
  await page.getByLabel("Password", {exact:true}).fill(randomUUID()+"aA1!");
  await page.getByRole("button", {name:"Create account",exact:true}).click();
  await expect(page.getByText("Live updates connected", {exact:true})).toBeVisible({timeout:45000});
  console.log("PASS Auth signup/session + authenticated Function + Realtime subscription");
  const title = `Synthetic E2E ${randomUUID()}`;
  await page.getByLabel("Case type",{exact:true}).selectOption("health_insurance");
  await page.getByLabel("Case title").fill(title);
  await page.getByLabel("Bill amount ($)").fill("1200");
  await page.getByLabel("EOB responsibility ($)").fill("400");
  await page.getByLabel("Case notes").fill("Synthetic data only; no hospital or patient involved.");
  await page.getByRole("button", {name:"Save case"}).click();
  const card = page.locator("article").filter({hasText:title});
  await expect(card).toBeVisible({timeout:20000});
  await expect(card.getByText("$800.00", {exact:true})).toBeVisible();
  console.log("PASS Postgres write and live query delivery; discrepancy is $800");
  await page.reload();
  await expect(card).toBeVisible({timeout:20000});
  console.log("PASS persisted case survives reload");
  const caseId=await card.getAttribute("data-case-id");
  const unauth=await fetch(`${apiBase}/cases`);
  expect(unauth.status).toBe(401);
  const malformed=await fetch(`${apiBase}/cases`,{headers:{Authorization:"Bearer invalid"}});
  expect(malformed.status).toBe(401);
  const invalid=await fetch(`${apiBase}/cases`,{method:"POST",headers:{Authorization:authorization,"Content-Type":"application/json"},body:JSON.stringify({title:"bad",bill_cents:-1,eob_cents:0})});
  expect(invalid.status).toBe(400);
  const crew=await fetch(`${apiBase}/cases/${caseId}/crew`,{method:"POST",headers:{Authorization:authorization}});
  expect(crew.status).toBe(403);
  const repair=await fetch(`${apiBase}/cases/${caseId}/crew/repair`,{method:"POST",headers:{Authorization:authorization}});
  expect(repair.status).toBe(403);
  console.log("PASS missing/invalid authentication, invalid amounts, and unauthorized crew spend rejected");
  const otherContext=await browser.newContext();
  try {
    const other=await otherContext.newPage();let otherAuthorization="";
    other.on("request",request=>{if(request.url().startsWith(apiBase)&&request.headers().authorization)otherAuthorization=request.headers().authorization;});
    await other.goto("http://localhost:4173");
    await other.getByRole("button",{name:"New here? Create an account"}).click();
    await other.getByLabel("Name",{exact:true}).fill("Isolation test");
    await other.getByLabel("Email",{exact:true}).fill(`isolation-${randomUUID()}@example.com`);
    await other.getByLabel("Password",{exact:true}).fill(randomUUID()+"aA1!");
    await other.getByRole("button",{name:"Create account",exact:true}).click();
    await expect(other.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
    await expect(other.getByText(title,{exact:true})).toHaveCount(0);
    for(const [method,path] of [["GET",`/cases/${caseId}/reply-monitors`],["GET",`/cases/${caseId}/replies`],["PATCH",`/cases/${caseId}`],["GET",`/cases/${caseId}/crew`],["POST",`/cases/${caseId}/crew`],["POST",`/cases/${caseId}/crew/repair`],["DELETE",`/cases/${caseId}`]]) {
      const response=await fetch(apiBase+path,{method,headers:{Authorization:otherAuthorization}});
      expect(response.status).toBe(404);
    }
    const list=await fetch(apiBase+"/cases",{headers:{Authorization:otherAuthorization}});
    expect((await list.json()).some((c:{id:string})=>c.id===caseId)).toBe(false);
    console.log("PASS second user cannot see, edit, run, or delete first user's case (including Realtime)");
  } finally {await otherContext.close();}


  await card.getByRole("button", {name:"Review with AI"}).click();
  await expect(page.getByRole("alert")).toContainText("AI analysis is unavailable", {timeout:25000});
  console.log("BLOCKED AI inference — gateway has no enabled model; unavailable state displayed correctly");
  page.once("dialog", dialog => dialog.accept());
  await card.getByRole("button", {name:"Delete",exact:true}).click();
  await expect(card).toHaveCount(0, {timeout:20000});
  console.log("PASS case deletion and live query removal");
  await page.getByRole("button", {name:"Sign out",exact:true}).click();
  await expect(page.getByRole("button", {name:"Sign in",exact:true})).toBeVisible({timeout:15000});
  console.log("PASS sign-out");
} catch (error) {
  console.error("E2E failed:", error instanceof Error ? error.message : "unknown");
  console.error("Visible page:", (await page.locator("main").innerText()).slice(0,1800));
  process.exitCode=1;
} finally { await context.close(); await browser.close(); }
