// iPhone UI audit: WebKit with Playwright iPhone profiles against the local app (scripts/mobile-audit/vite.config.ts on :4290).
// Every network call is mocked with fictional data; nothing reaches a real service. See docs/frontend.md "Mobile audit".
import {webkit,devices,type Page,type BrowserContext} from "@playwright/test";
import {mkdirSync,writeFileSync} from "node:fs";
const OUT=process.env.OUT??"test-results/mobile-audit";mkdirSync(OUT,{recursive:true});const BASE="http://127.0.0.1:4290/";
const API="https://mock-cases.compute.example.com", PHONE="https://mock-phone.compute.example.com";
const owner="phone:fictional-owner";
const now=Date.now(), iso=(m:number)=>new Date(now-m*60000).toISOString();
const C1="11111111-1111-4111-8111-111111111111",C2="22222222-2222-4222-8222-222222222222",C3="33333333-3333-4333-8333-333333333333";
const cases=[
 {id:C1,owner_id:owner,title:"Chemical burn at the Westbrook Pharma office lab — workers’ compensation claim",case_type:"workplace_injury",revision:2,bill_cents:null,eob_cents:null,status:"human_required",analysis:null,notes:"Fictional",intake:{injury_description:"Splashed with a cleaning solvent in the office lab on Nov 1; treated at urgent care for a second-degree burn on the left forearm.",employer_name:"Westbrook Pharma (fictional)",insurer_name:"Harbor Mutual Claims (fictional)",claim_number:"WC-2026-0049182-FICTIONAL",claim_stage:"reported"},created_at:iso(3000)},
 {id:C2,owner_id:owner,title:"Denied MRI claim",case_type:"health_insurance",revision:1,bill_cents:240000,eob_cents:65000,status:"active",analysis:null,notes:"",intake:{injury_description:"MRI denied as not medically necessary.",insurer_name:"Example Benefits",claim_number:"DEMO-1042",claim_stage:"denied"},created_at:iso(1500)},
 {id:C3,owner_id:owner,title:"Urgent care bill",case_type:"health_insurance",revision:1,bill_cents:52000,eob_cents:12000,status:"resolved",analysis:null,notes:"",intake:{injury_description:"Billed out of network.",insurer_name:"Example Benefits",claim_stage:"appeal"},created_at:iso(9000)},
];
const msgs:Record<string,any[]>={
 [C1]:[
  {id:"m1",role:"assistant",text:"Hi — I’ve opened your workers’ compensation case for the burn at Westbrook Pharma. I’ll handle the paperwork with Harbor Mutual and keep you posted here.",created_at:iso(2900),kind:"message"},
  {id:"m2",role:"assistant",text:"First, I need the urgent care discharge papers. They show the diagnosis and the date of treatment, which the claims administrator needs.",created_at:iso(2899),kind:"document_request"},
  {id:"m3",role:"user",text:"Sure, I'll find them tonight. Do you also need the incident report my manager filed?",created_at:iso(1400),kind:"owner_message"},
  {id:"m4",role:"assistant",text:"Yes please — the incident report helps confirm the injury happened at work. If you don’t have a copy, I can request it from HR at westbrook-pharma-hr-department@fictional-example.com on your behalf.",created_at:iso(1399),kind:"message"},
  {id:"m5",role:"assistant",text:"What date did you first notify your supervisor about the burn?",created_at:iso(20),kind:"request_human"},
 ],
 [C2]:[], [C3]:[{id:"r1",role:"assistant",text:"Example Benefits reprocessed the claim. Your reported responsibility dropped from $520.00 to $120.00.",created_at:iso(8000),kind:"message"}],
};
const outcome=[{id:"o1",created_at:iso(8000),evidence_current:true,independently_verified:false,attribution:"agent_reported",report:{summary:"Insurer reprocessed the claim as in-network.",claim_decision:"accepted",original_responsibility_cents:52000,final_responsibility_cents:12000,reduction_cents:40000,refund_received_cents:null,calculation_explanation:"Original $520 minus revised $120.",evidence:[{source_ref:"document:eob-revised",quote:"Patient responsibility: $120.00"}]}}];
function autonomy(id:string){
 const state=id===C1?"human_required":id===C2?"waiting":"completed";
 return {authorities:[{id:"a-"+id,state:state==="completed"?"completed":state,policy:{version:2}}],decisions:[
   {id:"d1",round:1,state:"finished",created_at:iso(2800),decision:{tool:"send_email",reason:"Ask the claims administrator for the claim acknowledgment letter."},result:null},
   {id:"d2",round:2,state:"finished",created_at:iso(600),decision:{tool:"research",reason:"Checked the state workers’ compensation reporting deadline."},result:null}],
  sessions:[{id:"s-"+id,authority_id:"a-"+id,engine:"naive",state,goal:"Get the claim accepted and medical bills paid by the insurer.",reason:id===C1?"Need the date you notified your supervisor.":null,waiting_on:id===C2?"Example Benefits’ reply to the appeal":null,created_at:iso(2900),next_check_at:null}],activation_available:true};
}
const docs:Record<string,any[]>={[C1]:[{id:"doc1",filename:"Urgent_Care_Discharge_Summary_2026-11-01_Westbrook_final_v2.pdf",state:"ready",kind:"other",extraction_state:"complete",extraction_result:{visible_text:"Discharge summary. Second-degree chemical burn, left forearm. Seen 11/01/2026.",insurer_name:"Harbor Mutual Claims",member_name:null,member_id:null,group_number:null,claim_number:"WC-2026-0049182",uncertainties:["Treatment date is handwritten."]},created_at:iso(1000)}],[C2]:[],[C3]:[]};
async function mock(ctx:BrowserContext,opts:{signedIn:boolean,cases:any[],empty?:boolean}){
 const json=(b:any,s=200)=>({status:s,contentType:"application/json",body:JSON.stringify(b),headers:{"access-control-allow-origin":"http://127.0.0.1:4290","access-control-allow-credentials":"true","access-control-allow-headers":"content-type,authorization","access-control-allow-methods":"GET,POST,PATCH,DELETE,OPTIONS"}});
 await ctx.route(/mock-(phone|cases|auth|rt)\./,async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,m=req.method();
  if(m==="OPTIONS")return route.fulfill(json({}));
  if(u.host.startsWith("mock-phone")){
   if(p.endsWith("/status"))return route.fulfill(json({enabled:true,smsReady:true,onboardingEnabled:true,testNumbers:[],testCode:null}));
   if(p.endsWith("/get-session"))return route.fulfill(json(opts.signedIn?{user:{id:"fictional-owner",linkedOwnerId:owner,name:"",phoneNumber:"+14155550123"},session:{id:"s"}}:null));
   if(p.endsWith("/token"))return route.fulfill(json({token:"fictional"}));
   if(p.endsWith("/send-otp"))return route.fulfill(json({ok:true}));
   return route.fulfill(json({}));
  }
  if(u.host.startsWith("mock-auth"))return route.fulfill(json(null));
  if(p==="/cases/live")return route.fulfill(json({sealed:true}));
  if(p==="/stack/status")return route.fulfill(json({naive:{configured:true,enabledForUser:true}}));
  if(p==="/phone/onboarding")return route.fulfill(json({enabled:true,status:"completed",case_id:C1,phone:"+14155550123"}));
  if(p.startsWith("/phone/"))return route.fulfill(json([]));
  if(p==="/firm/contact")return route.fulfill(json({email:"help@assurance.example"}));
  const mm=p.match(/^\/cases\/([\w-]+)\/(\w+)/);
  if(mm){const [,id,sub]=mm;
   if(sub==="messages")return route.fulfill(json({messages:opts.empty?[]:msgs[id]??[],state:autonomy(id).sessions[0].state,can_send:true}));
   if(sub==="documents")return route.fulfill(json(opts.empty?[]:docs[id]??[]));
   if(sub==="autonomy")return route.fulfill(json(opts.empty?{authorities:[],decisions:[],sessions:[],activation_available:true}:autonomy(id)));
   if(sub==="outcomes")return route.fulfill(json(id===C3&&!opts.empty?outcome:[]));
   if(sub==="replies")return route.fulfill(json({replies:[]}));
   if(sub==="actions")return route.fulfill(json([]));
   if(sub==="crew")return route.fulfill(json(null));
   return route.fulfill(json({connected:false}));
  }
  return route.fulfill(json({}));
 });
 await ctx.addInitScript(([signedIn,list])=>{ (window as any).__CASES__=list; if(signedIn){localStorage.setItem("assurance-phone-session","fictional");localStorage.setItem("assurance-auth-mode","phone");} },[opts.signedIn,opts.cases] as const);
}
const metricsJs=()=>{
 const vw=window.innerWidth, out:any={vw,vh:window.innerHeight,scrollW:document.documentElement.scrollWidth,overflowing:[],smallTargets:[],smallInputs:[],tinyText:[]};
 const vis=(e:Element)=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"&&!(r.width<=1&&r.height<=1);};
 const name=(e:Element)=>{const h=e as HTMLElement;return `${e.tagName.toLowerCase()}${h.className&&typeof h.className==="string"?"."+h.className.trim().split(/\s+/).join("."):""} “${(h.getAttribute("aria-label")||h.innerText||"").trim().slice(0,40)}”`;};
 for(const e of document.querySelectorAll("body *")){if(!vis(e))continue;const r=e.getBoundingClientRect();if(r.right>vw+1||r.left<-1){const s=getComputedStyle(e);let clipped=false;let p=e.parentElement;while(p){const ps=getComputedStyle(p);if(ps.overflowX!=="visible"||ps.overflow!=="visible"){const pr=p.getBoundingClientRect();if(pr.right<=vw+1&&pr.left>=-1){clipped=true;break;}}p=p.parentElement;}if(!clipped&&s.position!=="fixed")out.overflowing.push(name(e)+` [${Math.round(r.left)}..${Math.round(r.right)}]`);}}
 for(const e of document.querySelectorAll("a,button,input,select,textarea,summary,[role=button],label[for]")){if(!vis(e))continue;const r=e.getBoundingClientRect();if(r.width<44||r.height<44){const t=e as HTMLInputElement;if(t.type==="file")continue;out.smallTargets.push(name(e)+` ${Math.round(r.width)}x${Math.round(r.height)}`);}}
 for(const e of document.querySelectorAll("input,textarea,select")){if(!vis(e))continue;const fs=parseFloat(getComputedStyle(e).fontSize);if(fs<16)out.smallInputs.push(name(e)+` ${fs}px`);}
 const seen=new Set();for(const e of document.querySelectorAll("p,span,small,a,button,li,label,dd,dt,time,h1,h2,h3,strong")){if(!vis(e)||!(e as HTMLElement).innerText?.trim())continue;const fs=parseFloat(getComputedStyle(e).fontSize);if(fs<12){const k=name(e)+` ${fs}px`;if(!seen.has(k)){seen.add(k);out.tinyText.push(k);}}}
 out.overflowing=out.overflowing.slice(0,25);out.smallTargets=out.smallTargets.slice(0,40);out.tinyText=out.tinyText.slice(0,30);return out;
};
const report:any[]=[];
async function shot(page:Page,name:string,full=true){
 await page.waitForTimeout(900);
 await page.screenshot({path:`${OUT}/${name}.png`});
 if(full)await page.screenshot({path:`${OUT}/${name}-full.png`,fullPage:true});
 const m=await page.evaluate(metricsJs);report.push({name,...m});
}
const deviceName=process.env.DEVICE??"iPhone 15";
const browser=await webkit.launch();
async function ctxFor(opts:any){const ctx=await browser.newContext({...devices[deviceName]});await ctx.addInitScript("window.__name=(f)=>f");await mock(ctx,opts);const page=await ctx.newPage();const errs:string[]=[];page.on("pageerror",e=>errs.push(String(e)));page.on("console",m=>{if(m.type()==="error")errs.push(m.text());});(page as any).errs=errs;return {ctx,page};}
const tag=deviceName.replace(/\s+/g,"-").toLowerCase();
try{
 // Signed out
 {const {ctx,page}=await ctxFor({signedIn:false,cases:[]});
  await page.goto(BASE+"#home");await page.waitForTimeout(3500);await shot(page,`${tag}-01-landing`);
  await page.evaluate(()=>window.scrollTo(0,window.innerHeight));await shot(page,`${tag}-02-landing-scrolled`,false);
  await page.goto(BASE+"#workspace");await page.waitForTimeout(1500);await shot(page,`${tag}-03-signin`);
  const tel=page.locator("input[type=tel], input[inputmode=tel], input").first();await tel.click().catch(()=>{});await tel.fill("4155550123").catch(()=>{});await shot(page,`${tag}-04-signin-filled`,false);
  const btn=page.getByRole("button").filter({hasText:/verify|code|call|continue/i}).first();await btn.click().catch(()=>{});await page.waitForTimeout(1200);await shot(page,`${tag}-05-signin-code`);
  report.push({name:`${tag}-signedout-errors`,errors:(page as any).errs});await ctx.close();}
 // Signed in with cases
 {const {ctx,page}=await ctxFor({signedIn:true,cases});
  await page.goto(BASE+"#workspace");await page.waitForTimeout(3000);await shot(page,`${tag}-06-overview`);
  const menu=page.getByRole("button",{name:/menu|open navigation|open/i}).first();
  if(await menu.isVisible().catch(()=>false)){await menu.click();await shot(page,`${tag}-07-drawer`,false);await page.keyboard.press("Escape");}
  else report.push({name:"drawer",note:"no menu button found"});
  await page.goto(BASE+"#case/"+C1);await page.waitForTimeout(3000);await shot(page,`${tag}-08-case-chat`);
  const ta=page.getByRole("textbox",{name:"Message Assurance",exact:true});
  if(await ta.isVisible().catch(()=>false)){await ta.click();await ta.fill("It was November 1st, right after it happened. My manager Dana was there.");await shot(page,`${tag}-09-case-typing`,false);await ta.fill("");}
  const info=page.getByRole("button",{name:/case info/i}).first();
  if(await info.isVisible().catch(()=>false)){await info.click();await page.waitForTimeout(800);await shot(page,`${tag}-10-case-info`,false);
   const sheet=page.getByRole("dialog").first();for(let i=1;i<=4;i++){await sheet.evaluate((d,i)=>{const sc=[d,...d.querySelectorAll("*")].find(e=>e.scrollHeight>e.clientHeight+5&&getComputedStyle(e).overflowY!=="visible")as HTMLElement|undefined;if(sc)sc.scrollTop=i*sc.clientHeight*0.85;},i).catch(()=>{});await shot(page,`${tag}-10-case-info-${i}`,false);}
   await page.keyboard.press("Escape");}
  await page.goto(BASE+"#case/"+C3);await page.waitForTimeout(2500);await shot(page,`${tag}-11-case-resolved`);
  await page.goto(BASE+"#case/"+C2);await page.waitForTimeout(2500);await shot(page,`${tag}-12-case-empty-chat`);
  await page.goto(BASE+"#new");await page.waitForTimeout(2000);await shot(page,`${tag}-13-new-case`);
  const det=page.getByText(/Additional details/i).first();if(await det.isVisible().catch(()=>false)){await det.click();await shot(page,`${tag}-14-new-case-details`);}
  report.push({name:`${tag}-signedin-errors`,errors:(page as any).errs});await ctx.close();}
 // Signed in, no cases, empty case
 {const {ctx,page}=await ctxFor({signedIn:true,cases:[],empty:true});
  await page.goto(BASE+"#workspace");await page.waitForTimeout(2500);await shot(page,`${tag}-15-first-run`);await ctx.close();}
 {const {ctx,page}=await ctxFor({signedIn:true,cases:[cases[1]],empty:true});
  await page.goto(BASE+"#case/"+C2);await page.waitForTimeout(2500);await shot(page,`${tag}-16-case-brand-new`);await ctx.close();}
}finally{writeFileSync(`${OUT}/${tag}-report.json`,JSON.stringify(report,null,1));await browser.close();}
