import {chromium,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {config} from "dotenv";
import {Pool} from "pg";
config({path:".env.local",quiet:true});
const file="test-results/document-reader-app.json";
const run=existsSync(file)?JSON.parse(readFileSync(file,"utf8")):{title:`Synthetic Assurance evidence ${randomUUID()}`,pdfId:randomUUID()};
const save=()=>writeFileSync(file,JSON.stringify(run),{mode:0o600});save();
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:1});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({storageState:"test-results/crew-app-browser.json"});const page=await context.newPage();let token="",base="";
 page.on("request",r=>{if(r.url().endsWith("/stack/status")){token=r.headers().authorization;base=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});await expect(page).toHaveTitle("Assurance");
 const headers={Authorization:token,"Content-Type":"application/json"};
 const request=async(path:string,method="GET",body?:unknown)=>fetch(base+path,{method,headers,...body===undefined?{}:{body:JSON.stringify(body)},signal:AbortSignal.timeout(45000)});
 const status=await(await request("/stack/status")).json();if(!status.naive.enabledForUser)throw Error("Await the existing deployment; test operator is not active yet");
 if(!run.caseId){const created=await request("/cases","POST",{title:run.title,case_type:"workplace_injury",intake:{contact_name:"Alex Example",contact_email:"alex@example.com",injury_description:"Synthetic chemical splash at a pharmaceutical workplace; employer coverage unknown.",jurisdiction:"California"},bill_cents:null,eob_cents:null,notes:"Synthetic case. No external outreach authorized."});expect(created.status).toBe(201);run.caseId=(await created.json()).id;save();}
 const path=`/cases/${run.caseId}/documents`;const card=page.locator("article").filter({hasText:run.title});await expect(card).toBeVisible({timeout:20000});
 const fixture=await context.newPage();await fixture.setViewportSize({width:850,height:450});await fixture.setContent('<main style="font:28px sans-serif;padding:30px"><h1>DEMO ONLY — NOT VALID</h1><p>Insurer: Fictional Health Plan</p><p>Member: Alex Example</p><p>Member ID: SYNTH-48291</p><p>Group: DEMO-17</p><p>This card does not establish coverage.</p></main>');
 if(!run.imageId){await card.getByLabel("Document file",{exact:true}).setInputFiles({name:"synthetic-reader-card.png",mimeType:"image/png",buffer:await fixture.screenshot()});await card.getByRole("button",{name:"Save document",exact:true}).click();await expect(card.getByRole("button",{name:"Download synthetic-reader-card.png",exact:true})).toBeVisible({timeout:30000});const list=await(await request(path)).json();run.imageId=list.find((d:any)=>d.filename==="synthetic-reader-card.png").id;save();}
 if(!run.pdfUploaded){await fixture.setContent('<p>SYNTHETIC ONLY</p><p>Insurer: Fictional Health Plan</p><p>Claim number: DEMO-CLAIM-29</p><p>Claim status: pending additional employer information. This is not a coverage decision.</p>');const data=new FormData();data.set("id",run.pdfId);data.set("kind","other");data.set("file",new Blob([new Uint8Array(await fixture.pdf())],{type:"application/pdf"}),"synthetic-claim-letter.pdf");const r=await fetch(base+path,{method:"POST",headers:{Authorization:token},body:data,signal:AbortSignal.timeout(45000)});expect(r.ok).toBe(true);run.pdfUploaded=true;save();}
 await fixture.close();
 for(const id of [run.imageId,run.pdfId]){
  const endpoint=`${path}/${id}/extraction`;const starts=await Promise.all([request(endpoint,"POST"),request(endpoint,"POST")]);for(const r of starts)expect(r.ok).toBe(true);
  let done=false;
  for(let n=0;n<30;n++){const r=await request(`${endpoint}/refresh`,"POST");const result=await r.json();if(!r.ok)throw Error(JSON.stringify(result));if(result.state==="ready"){if(id===run.imageId){expect(result.result.member_id).toBe("SYNTH-48291");expect(result.result.insurer_name).toBe("Fictional Health Plan");}else expect(result.result.claim_number).toBe("DEMO-CLAIM-29");done=true;break;}if(["failed","unknown"].includes(result.state))throw Error(`Reader stopped: ${result.state}`);console.log(`Reading ${id===run.imageId?"image":"PDF"}: ${result.state}`);await new Promise(r=>setTimeout(r,5000));}
  expect(done).toBe(true);
  const {rows:[before]}=await pool.query("SELECT revision FROM advocacy_cases WHERE id=$1",[run.caseId]);
  const {rows:[old]}=await pool.query("SELECT confirmed_at,session_id FROM advocacy_document_extractions WHERE document_id=$1",[id]);
  const confirmed=await Promise.all([request(`${endpoint}/confirm`,"POST",{confirm:true}),request(`${endpoint}/confirm`,"POST",{confirm:true})]);for(const r of confirmed)expect(r.ok).toBe(true);
  const {rows:[after]}=await pool.query("SELECT revision FROM advocacy_cases WHERE id=$1",[run.caseId]);expect(after.revision).toBe(before.revision+(old.confirmed_at?0:1));
  const repeat=await request(endpoint,"POST");expect(repeat.ok).toBe(true);const {rows:[current]}=await pool.query("SELECT session_id FROM advocacy_document_extractions WHERE document_id=$1",[id]);expect(current.session_id).toBe(old.session_id);
 }
 console.log("PASS live image and PDF extraction, concurrent start reuse, exact fields, confirmation once, and stable session IDs");
 await page.reload();await expect(card.getByText("Document transcription · confirmed",{exact:true})).toHaveCount(2,{timeout:20000});
 const start=await request(`/cases/${run.caseId}/crew`,"POST");expect(start.ok).toBe(true);run.crewSession=(await start.json()).session_id;save();let final:any;
 for(let n=0;n<40;n++){const r=await request(`/cases/${run.caseId}/crew`);expect(r.ok).toBe(true);final=await r.json();if(final.saved_at)break;if(final.stop_reason==="error")throw Error("Crew failed; retained session for inspection");console.log(`Evidence crew: ${final.status}/${final.stop_reason??"running"}`);await new Promise(r=>setTimeout(r,5000));}
 expect(final.saved_at).toBeTruthy();expect(final.result.potential_discrepancy_cents).toBe(null);expect(final.result.document_references.length).toBeGreaterThan(0);
 const {rows:[saved]}=await pool.query("SELECT message FROM advocacy_crew_runs WHERE session_id=$1",[run.crewSession]);const captured=JSON.parse(saved.message);expect(captured.documents.filter((d:any)=>d.confirmed_at&&d.result).length).toBe(2);
 writeFileSync("test-results/document-reader-review.json",JSON.stringify(final),{mode:0o600});
 console.log("PASS completed claim crew uses immutable confirmed document evidence with exact source hashes; unknown financial outcome stays null");
}finally{await browser.close();await pool.end();}
