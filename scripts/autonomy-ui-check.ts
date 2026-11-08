import {DEFAULT_INTAKE_CONSENT} from "../backend/intake-policy";
import {expect,type Page} from "@playwright/test";
export async function checkAutonomyPermissions(page:Page,apiBase:string,caseId:string){
 const stackPath=`${apiBase}/stack/status`,crewPath=`${apiBase}/cases/${caseId}/crew`,path=`${apiBase}/cases/${caseId}/autonomy`;
 const posted:Record<string,any>[]=[],revoked:string[]=[],resumed:unknown[]=[];
 const authorityId="22222222-2222-4222-8222-222222222222",runId="11111111-1111-4111-8111-111111111111";
 let authorities:any[]=[],sessions:any[]=[],setups:any[]=[],available=true;
 await page.route(stackPath,route=>route.fulfill({json:{naive:{configured:true,enabledForUser:true}}}));
 // Activation must work without a saved review.
 await page.route(crewPath,route=>route.fulfill({json:{status:"not_started",saved_at:null,result:null}}));
 await page.route(path,route=>{
  if(route.request().method()==="POST"){
   const body=route.request().postDataJSON();posted.push(body);authorities=[{id:authorityId,state:"active",reason:null,next_wake_at:null,policy:body.policy,decisions_used:0,outbound_used:0}];setups=[{id:"synthetic-setup",authority_id:authorityId,state:"queued",reason:null}];
   return route.fulfill({status:201,json:authorities[0]});
  }
  return route.fulfill({json:{authorities,decisions:[],sessions,activation_available:available,persistent_available:true,setups}});
 });
 const updates:any[]=[];const updatesPath=`${apiBase}/cases/${caseId}/updates`;
 await page.route(updatesPath,route=>{updates.push(route.request().postDataJSON());sessions=sessions.map(s=>({...s,state:"running",waiting_on:null}));return route.fulfill({json:{saved:true,resumed:true}});});
 const revokePath=`${path}/${authorityId}/revoke`;
 await page.route(revokePath,route=>{revoked.push(authorityId);authorities=authorities.map(a=>({...a,state:"revoked",reason:"Stopped by the owner"}));sessions=sessions.map(s=>({...s,state:"stopped"}));setups=[];return route.fulfill({json:authorities[0]});});
 const resumePath=`${path}/${authorityId}/resume`;
 await page.route(resumePath,route=>{resumed.push(route.request().postDataJSON());sessions=sessions.map(s=>({...s,state:"running",waiting_on:null}));return route.fulfill({json:{state:"active"}});});
 const card=page.locator(`article[data-case-id="${caseId}"]`);
 async function reload(){await page.reload();await expect(card).toBeVisible({timeout:20000});for(const summary of await card.locator("details.workflow-section > summary").all())if(await summary.locator("..").getAttribute("open")===null)await summary.click();}
 try{
  await reload();const panel=card.getByRole("region",{name:"Case agent activation"}),form=panel.getByRole("form",{name:"Start case agent"});
  await expect(panel.getByText("This saved case has not started yet.",{exact:true})).toBeVisible();
  await expect(form.getByRole("checkbox")).toHaveCount(0);await expect(form.getByRole("textbox")).toHaveCount(0);
  await form.getByRole("button",{name:"Start handling my case",exact:true}).click();await expect.poll(()=>posted.length).toBe(1);
  expect(posted[0]).toEqual({authorize:true,persistent:true,policy:{version:2,consent:DEFAULT_INTAKE_CONSENT}});
  await expect(panel.getByRole("heading",{name:"Getting started",exact:true})).toBeVisible();await expect(form).toHaveCount(0);
  sessions=[{id:runId,authority_id:authorityId,state:"running",engine:"direct_openai",goal:"Find supported claim avenues",finish_condition:"Document an insurer decision and any remaining responsibility",next_check_at:null,reason:null,created_at:new Date().toISOString()}];setups=[];
  await reload();await expect(panel.getByRole("heading",{name:"Working",exact:true})).toBeVisible();await expect(panel.getByText("Find supported claim avenues",{exact:true})).toBeVisible();
  sessions[0]={...sessions[0],state:"human_required",waiting_on:"Please provide the fictional claim reference."};await reload();
  await expect(panel.getByRole("heading",{name:"Needs your attention",exact:true})).toBeVisible();await expect(panel.getByRole("button",{name:"Review pending actions",exact:true})).toHaveCount(0);
  await panel.getByLabel("Your response",{exact:true}).fill("The incident happened on November 3.");await panel.getByRole("button",{name:"Send response",exact:true}).click();await expect.poll(()=>updates.length).toBe(1);expect(updates[0].text).toBe("The incident happened on November 3.");expect(updates[0].id).toMatch(/^[0-9a-f-]{36}$/);await expect(panel.getByText("Update saved.",{exact:true})).toBeVisible();
  sessions[0]={...sessions[0],state:"human_required"};await reload();
  await panel.getByRole("button",{name:"Continue with updated information",exact:true}).click();await expect.poll(()=>resumed.length).toBe(1);expect(resumed[0]).toEqual({confirm:true});await expect(panel.getByRole("heading",{name:"Working",exact:true})).toBeVisible();
  await panel.getByRole("button",{name:"Stop agent work",exact:true}).click();await expect.poll(()=>revoked.length).toBe(1);await expect(panel.getByRole("heading",{name:"Stopped",exact:true})).toBeVisible();
  available=false;await reload();await expect(panel.getByRole("form",{name:"Start case agent"})).toHaveCount(0);await expect(panel.getByText("Agent work is temporarily unavailable. Your case is saved.",{exact:true})).toBeVisible();
  const hash="a".repeat(64),approvalPath=`${apiBase}/cases/${caseId}/sessions/${runId}/approvals`,decisions:any[]=[];
  sessions=[{id:runId,authority_id:authorityId,state:"human_required",engine:"naive",reason:"Synthetic provider approval",next_check_at:null}];
  await page.route(approvalPath,route=>{
   if(route.request().method()==="POST"){decisions.push(route.request().postDataJSON());return route.fulfill({json:{state:"confirmed"}});}
   return route.fulfill({json:{status:"idle",stop_reason:"awaiting_approval",actions:[{hash,name:"assurance.case_get",args:{case_id:caseId},supported:true}],history:[]}});
  });
  await reload();await panel.getByRole("button",{name:"Review pending actions",exact:true}).click();await expect(panel.getByRole("heading",{name:"assurance.case_get",exact:true})).toBeVisible();await panel.getByRole("button",{name:"Approve this action",exact:true}).click();
  await expect.poll(()=>decisions.length).toBe(1);expect(decisions[0]).toEqual({confirm:true,hash,decision:"allow"});await page.unroute(approvalPath);
  console.log("PASS mocked activation UI: no review prerequisite, single-click v2 scope with no permission form, queued/running/waiting/stopped statuses, owner resume without changing permission, and Naïve-only provider approval. No live grant or outreach created.");
 }catch(error){console.error("Activation UI failure state:",(await card.innerText()).slice(0,2500));throw error;}
 finally{await page.unroute(stackPath);await page.unroute(crewPath);await page.unroute(path);await page.unroute(revokePath);await page.unroute(resumePath);await page.unroute(updatesPath);}
}
