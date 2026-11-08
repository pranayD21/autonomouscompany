import {chromium,expect} from "@playwright/test";
import {readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
const action=JSON.parse(readFileSync("test-results/email-dispatch-result.json","utf8"));const mode=process.argv[2]??"verify";
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({storageState:"test-results/crew-app-browser.json"});const page=await context.newPage();let token="",base="";
 page.on("request",r=>{if(r.url().endsWith("/stack/status")){token=r.headers().authorization;base=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
 const headers={Authorization:token,"Content-Type":"application/json"};const path=`${base}/cases/${action.case_id}`;
 const row=page.locator(`[data-action-id="${action.id}"]`);
 if(mode==="enable"){
  const monitors=await(await fetch(`${path}/reply-monitors`,{headers})).json();const existing=monitors.find((m:any)=>m.action_id===action.id);
  if(!existing?.enabled){const pending=page.waitForResponse(r=>r.url().endsWith(`/actions/${action.id}/reply-monitor`)&&r.request().method()==="POST");await row.getByRole("button",{name:"Monitor replies",exact:true}).click();expect((await pending).ok()).toBe(true);}
  await expect(row.getByRole("button",{name:"Pause reply monitoring",exact:true})).toBeVisible();
  const before=await(await fetch(`${path}/replies`,{headers})).json();writeFileSync("test-results/reply-monitor-app.json",JSON.stringify({caseId:action.case_id,actionId:action.id,enabledAt:new Date().toISOString(),replyIds:before.replies.map((r:any)=>r.id)}),{mode:0o600});
  const worker=base.replace(/-cases\./,"-replypoll.");const invocation=randomUUID();const forged=await fetch(`${worker}/poll`,{method:"POST",headers:{"content-type":"application/json","x-neon-trigger-invocation-id":invocation},body:JSON.stringify({version:1,invocation_id:invocation,trigger:{type:"schedule",id:"forged",name:"reply-monitor"},data:{scheduled_at:new Date().toISOString()}})});expect(forged.status).toBe(401);
  const anon=await fetch(`${path}/reply-monitors`);expect(anon.status).toBe(401);
  const other=await browser.newContext();const p=await other.newPage();let otherToken="";p.on("request",r=>{if(r.url().endsWith("/stack/status"))otherToken=r.headers().authorization;});
  await p.goto("http://localhost:4173");await p.getByRole("button",{name:"New here? Create an account"}).click();await p.getByLabel("Name",{exact:true}).fill("Synthetic monitoring isolation");await p.getByLabel("Email",{exact:true}).fill(`monitor-${randomUUID()}@example.com`);await p.getByLabel("Password",{exact:true}).fill(randomUUID()+"Aa1!");await p.getByRole("button",{name:"Create account",exact:true}).click();await expect(p.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
  for(const [url,method]of [[`${path}/reply-monitors`,"GET"],[`${path}/actions/${action.id}/reply-monitor`,"POST"]]){const r=await fetch(url,{method,headers:{Authorization:otherToken,"Content-Type":"application/json"},...(method==="POST"?{body:JSON.stringify({enabled:false})}:{})});expect(r.status).toBe(404);}
  console.log("PASS owner enabled monitoring, cross-user and anonymous access denied, forged scheduler header rejected; awaiting a real trigger delivery");
 }else{
  const record=JSON.parse(readFileSync("test-results/reply-monitor-app.json","utf8"));const monitors=await(await fetch(`${path}/reply-monitors`,{headers})).json();const monitor=monitors.find((m:any)=>m.action_id===action.id);
  if(!monitor?.last_success_at||new Date(monitor.last_success_at)<new Date(record.enabledAt)){console.log("PENDING real scheduler check",JSON.stringify({lastAttempt:monitor?.last_attempt_at??null,error:monitor?.error_code??null}));process.exitCode=2;}
  else{expect(monitor.last_invocation_id).toBeTruthy();expect(monitor.error_code).toBeNull();const replies=await(await fetch(`${path}/replies`,{headers})).json();expect(replies.replies.map((r:any)=>r.id).sort()).toEqual(record.replyIds.sort());await expect(row.getByText(/Last successful check/)).toBeVisible();
   // Exercise pause/resume without sending anything. Leave the existing test thread monitored.
   for(const enabled of [false,true]){const r=await fetch(`${path}/actions/${action.id}/reply-monitor`,{method:"POST",headers,body:JSON.stringify({enabled})});expect(r.ok).toBe(true);expect((await r.json()).enabled).toBe(enabled);}
   writeFileSync("test-results/reply-monitor-result.json",JSON.stringify(monitor),{mode:0o600});console.log("PASS actual scheduled AgentMail read, persistent success/invocation record, no duplicate evidence, visible UI status, and pause/resume");}
 }
}finally{await browser.close();}
