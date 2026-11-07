import {test} from "node:test";
import assert from "node:assert/strict";
import {imageReadProven,extractionOutput,readPdfText} from "../backend/providers/document-reader";
import {chromium} from "@playwright/test";
import {completedCrewSnapshot} from "../backend/providers/crew-result";
test("image evidence requires successful completion of the exact file's view call",()=>{
 const start={type:"tool.started",data:{name:"view_image",tool_call_id:"call1",args:{file_ids:["fil_correct"]}}};
 const finish={type:"tool.completed",data:{name:"view_image",tool_call_id:"call1",is_error:false}};
 assert.equal(imageReadProven([start,finish],"fil_correct"),true);
 assert.equal(imageReadProven([start],"fil_correct"),false);
 assert.equal(imageReadProven([{...start,data:{...start.data,tool_call_id:undefined}},{...finish,data:{...finish.data,tool_call_id:undefined}}],"fil_correct"),false);
 assert.equal(imageReadProven([start,finish],"fil_other"),false);
 assert.equal(imageReadProven([start,{...finish,data:{...finish.data,is_error:true}}],"fil_correct"),false);
 assert.equal(imageReadProven([start,{...finish,data:{...finish.data,tool_call_id:"other"}}],"fil_correct"),false);
});
test("missing document fields stay null; empty transcription is invalid",()=>{
 const result={visible_text:"Synthetic",insurer_name:null,member_name:null,member_id:null,group_number:null,claim_number:null,uncertainties:["No insurer visible"]};
 assert.equal(extractionOutput.safeParse(result).success,true);assert.equal(extractionOutput.safeParse({...result,visible_text:""}).success,false);
});
test("review cannot cite a different document or hash, or omit supplied evidence",()=>{
 const source={document_id:"8abb9f74-8d3b-4fc1-bdf2-ac966a960d76",sha256:"a".repeat(64)};
 const session={status:"completed",stop_reason:"end_turn",consumed_micro_usd:1,pending_actions:[],structured_output:{summary:"Synthetic review",potential_discrepancy_cents:null,evidence:["document_evidence"],missing_information:[],next_actions:[],human_help_required:true,human_help_reason:"Missing claim details",document_references:[source]}};
 assert.equal(completedCrewSnapshot(session,null,[source]).output_valid,true);
 assert.equal(completedCrewSnapshot(session,null,[{...source,sha256:"b".repeat(64)}]).output_valid,false);
 assert.equal(completedCrewSnapshot(session,null,[]).output_valid,false);
 assert.equal(completedCrewSnapshot({...session,structured_output:{...session.structured_output,document_references:[]}},null,[source]).output_valid,false);
});
test("PDF text extraction reads real text and rejects an image-only page",async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();await page.setContent("<p>Synthetic insurer: Fictional PDF Plan</p>");
  assert.match(await readPdfText(new Uint8Array(await page.pdf())),/Fictional PDF Plan/);
  await page.setContent('<div style="width:100px;height:100px;background:black"></div>');
  const pagePdf=await page.pdf();
  await assert.rejects(()=>readPdfText(new Uint8Array(pagePdf)),/PDF_NO_TEXT/);
 }finally{await browser.close();}
});
