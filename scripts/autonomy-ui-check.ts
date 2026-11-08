import {expect,type Page} from "@playwright/test";
export async function checkAutonomyPermissions(page:Page,apiBase:string,caseId:string){
 const stackPath=`${apiBase}/stack/status`,crewPath=`${apiBase}/cases/${caseId}/crew`,path=`${apiBase}/cases/${caseId}/autonomy`;
 const posted:Record<string,any>[]=[];
 let sessions:any[]=[];
 await page.route(stackPath,route=>route.fulfill({json:{naive:{configured:true,enabledForUser:true}}}));
 await page.route(crewPath,route=>route.fulfill({json:{status:"idle",saved_at:new Date().toISOString(),result:{summary:"Synthetic permission UI fixture",missing_information:[],next_actions:[],evidence:[],human_help_required:false,human_help_reason:"",potential_discrepancy_cents:null}}}));
 await page.route(path,route=>{
  if(route.request().method()==="POST"){posted.push(route.request().postDataJSON());return route.fulfill({status:201,json:{}});}
  return route.fulfill({json:{authorities:[],decisions:[],sessions}});
 });
 try{
  await page.reload();
  const card=page.locator(`article[data-case-id="${caseId}"]`),form=card.locator("form").filter({has:page.getByLabel("Communication permission")});
  await expect(card).toBeVisible({timeout:20000});
  for(const summary of await card.locator("details.workflow-section > summary").all())if(await summary.locator("..").getAttribute("open")===null)await summary.click();
  const scope=form.getByLabel("Communication permission"),consent=form.getByRole("checkbox");
  await expect(scope).toHaveValue("research");await expect(form.getByLabel("Customer test email",{exact:true})).toHaveCount(0);
  console.log("UI check: switching review permission to email");
  await consent.check();await scope.selectOption("email");await expect(consent).not.toBeChecked();
  await form.getByLabel("Customer test email",{exact:true}).fill("fictional@example.com");
  console.log("UI check: switching back to review-only");
  await consent.check();await scope.selectOption("research");await expect(consent).not.toBeChecked();
  await consent.check();await form.getByRole("button",{name:"Authorize review only",exact:true}).click();
  await expect.poll(()=>posted.length).toBe(1);expect(posted[0].policy.contacts).toEqual([]);expect(posted[0].policy.max_outbound).toBe(0);
  await scope.selectOption("email");await form.getByLabel("Customer test email",{exact:true}).fill("fictional@example.com");await consent.check();
  await form.getByRole("button",{name:"Authorize autonomous email test",exact:true}).click();
  await expect.poll(()=>posted.length).toBe(2);expect(posted[1].policy.max_outbound).toBe(2);expect(posted[1].policy.contacts).toEqual([{id:"customer",role:"customer",channel:"email",destination:"fictional@example.com"}]);
  console.log("UI check: reviewing provider approval");
  const runId="11111111-1111-4111-8111-111111111111",hash="a".repeat(64),approvalPath=`${apiBase}/cases/${caseId}/sessions/${runId}/approvals`,decisions:any[]=[];
  sessions=[{id:runId,state:"human_required",reason:"Synthetic provider approval",next_check_at:null}];
  await page.route(approvalPath,route=>{
   if(route.request().method()==="POST"){decisions.push(route.request().postDataJSON());return route.fulfill({json:{state:"confirmed"}});}
   return route.fulfill({json:{status:"idle",stop_reason:"awaiting_approval",actions:[{hash,name:"assurance.case_get",args:{case_id:caseId},supported:true}],history:[]}});
  });
  await page.reload();await expect(card).toBeVisible({timeout:20000});for(const summary of await card.locator("details.workflow-section > summary").all())if(await summary.locator("..").getAttribute("open")===null)await summary.click();
  await card.getByRole("button",{name:"Review pending actions",exact:true}).click();
  await expect(card.getByRole("heading",{name:"assurance.case_get",exact:true})).toBeVisible();
  await card.getByRole("button",{name:"Approve this action",exact:true}).click();
  await expect.poll(()=>decisions.length).toBe(1);expect(decisions[0]).toEqual({confirm:true,hash,decision:"allow"});
  await page.unroute(approvalPath);
  console.log("PASS mocked pending-action UI: exact action shown and explicitly confirmed; no provider confirmation sent");
  console.log("PASS mocked authorization UI: review-only sends no contacts, email retains limits, scope changes clear consent; no live grant created");
 }catch(error){console.error("Permission UI failure state:",(await page.locator("main").innerText()).slice(0,2500));throw error;}finally{await page.unroute(stackPath);await page.unroute(crewPath);await page.unroute(path);await page.reload();}
}
