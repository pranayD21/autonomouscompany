import {config} from "dotenv";
import {createClient} from "@usenaive-sdk/managed-agents";
import {chromium} from "@playwright/test";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {naiveClient} from "../backend/providers/naive";
config({path:".env.local",quiet:true});
const path="test-results/card-reader-smoke.json";
const run=existsSync(path)?JSON.parse(readFileSync(path,"utf8")):{id:randomUUID()};
const save=()=>writeFileSync(path,JSON.stringify(run),{mode:0o600});save();
if(!run.fileId){
 const browser=await chromium.launch({headless:true});let bytes:Buffer;
 try{const page=await browser.newPage({viewport:{width:850,height:450}});await page.setContent('<main style="font:28px sans-serif;padding:30px"><h1>DEMO ONLY — NOT VALID</h1><p>Insurer: Fictional Health Plan</p><p>Member: Alex Example</p><p>Member ID: SYNTH-48291</p><p>Group: DEMO-17</p><p>This card does not establish coverage.</p></main>');bytes=await page.screenshot();}finally{await browser.close();}
 const client=createClient({baseUrl:"https://api.vetta.sh",apiKey:process.env.NAIVE_FILES_API_KEY!});const form=new FormData();form.set("file",new Blob([new Uint8Array(bytes)],{type:"image/png"}),"synthetic-insurance-card.png");
 run.fileId=(await client.files.upload(form)).id;save();
}
if(!run.sessionId){const session=await naiveClient().sessions.create({agent_id:process.env.NAIVE_INTAKE_ID!,message:`This is a synthetic document transcription test, not a claim review. Call view_image on file ID ${run.fileId}, then transcribe the insurer, member name, member ID, and group exactly as visible. Do not infer coverage. You MUST call submit_output with the schema; do not end with prose.`,budget_micro_usd:250000,structured_output_required:true,output_schema:{type:"object",properties:{insurer:{type:"string"},member_name:{type:"string"},member_id:{type:"string"},group:{type:"string"}},required:["insurer","member_name","member_id","group"],additionalProperties:false}},{idempotencyKey:run.id});run.sessionId=session.id;save();}
const session=await naiveClient().sessions.get(run.sessionId);
const output=session.structured_output as Record<string,string>|null;
console.log(JSON.stringify({status:session.status,stop_reason:session.stop_reason,output}));
if((session.status==="completed"||(session.status==="idle"&&session.stop_reason==="end_turn"))&&output?.member_id==="SYNTH-48291"&&output.insurer==="Fictional Health Plan"&&output.group==="DEMO-17")console.log("PASS live Naive image transcription matches synthetic card");
else process.exitCode=2;
