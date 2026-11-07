import {Hono} from "hono";
import type {Pool} from "pg";
import {z} from "zod";
import {createHash} from "node:crypto";
import {documentFiles} from "./document-storage";
import {extractionOutput,operatorAllowed,readerConfigured,readPdfText,startDocumentReader,uploadReaderImage,verifyImageRead} from "./providers/document-reader";
import {naiveClient} from "./providers/naive";

export function extractionRoutes(pool:Pool){
 const app=new Hono<{Variables:{userId:string}}>();
 // This router is mounted inside the case-owner-checked document router.
 app.use("*",async(c,next)=>{
  if(!z.uuid().safeParse(c.req.param("documentId")).success)return c.json({error:"Document not found."},404);
  const found=await pool.query("SELECT id FROM advocacy_documents WHERE id=$1 AND case_id=$2 AND state='ready'",[c.req.param("documentId"),c.req.param("id")]);
  if(!found.rowCount)return c.json({error:"Document not found."},404);
  await next();
 });
 app.post("/",async c=>{
  if(!operatorAllowed(c.get("userId")))return c.json({error:"Document reading is limited to configured test operators."},403);
  if(!readerConfigured())return c.json({error:"Document reading is not configured."},503);
  const id=c.req.param("documentId")!;
  const inserted=await pool.query("INSERT INTO advocacy_document_extractions(document_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING document_id",[id]);
  if(inserted.rowCount){
   let uploading=false;
   try{
    const {rows:[doc]}=await pool.query("SELECT * FROM advocacy_documents WHERE id=$1",[id]);
    const bytes=new Uint8Array(await(await documentFiles().download(doc.object_key)).arrayBuffer());
    if(createHash("sha256").update(bytes).digest("hex")!==doc.sha256)throw new Error("DOCUMENT_HASH_MISMATCH");
    let fileId:string|null=null,sourceText:string|null=null;
    if(doc.mime==="application/pdf")sourceText=await readPdfText(bytes);
    else{uploading=true;fileId=await uploadReaderImage(bytes,doc.mime);}
    await pool.query("UPDATE advocacy_document_extractions SET file_id=$2,source_text=$3,state='source_ready' WHERE document_id=$1",[id,fileId,sourceText]);
   }catch(e){
    const known=["PDF_NO_TEXT","PDF_PAGE_LIMIT","PDF_TEXT_LIMIT","DOCUMENT_HASH_MISMATCH"];
    const code=e instanceof Error&&known.includes(e.message)?e.message:uploading?"UPLOAD_OUTCOME_UNKNOWN":"DOCUMENT_READ_FAILED";
    await pool.query("UPDATE advocacy_document_extractions SET state=$2,error_code=$3 WHERE document_id=$1 AND state='preparing'",[id,uploading?"unknown":"failed",code]);
    return c.json({error:uploading?"The provider upload outcome is uncertain. It will not be repeated automatically; operator reconciliation is required.":"This document could not be read. For scanned PDFs, upload page images instead.",code},502);
   }
  }
  const {rows:[row]}=await pool.query("SELECT * FROM advocacy_document_extractions WHERE document_id=$1",[id]);
  if(row.state!=="source_ready")return c.json({state:row.state,error_code:row.error_code},row.state==="failed"||row.state==="unknown"?409:200);
  try{
   const session=await startDocumentReader(id,row.file_id,row.source_text);
   await pool.query("UPDATE advocacy_document_extractions SET session_id=$2,state='running' WHERE document_id=$1 AND state='source_ready'",[id,session.id]);
   return c.json({state:"running"},202);
  }catch{return c.json({error:"Reader start is pending. Retry uses the same session request and does not re-upload the document."},502);}
 });
 app.post("/refresh",async c=>{
  const id=c.req.param("documentId")!;const {rows:[row]}=await pool.query("SELECT * FROM advocacy_document_extractions WHERE document_id=$1",[id]);
  if(!row)return c.json({state:"not_started"});
  if(row.state!=="running")return c.json({state:row.state,result:row.result,error_code:row.error_code,confirmed_at:row.confirmed_at});
  try{
   const session=await naiveClient().sessions.get(row.session_id);
   const finished=session.status==="completed"||(session.status==="idle"&&session.stop_reason==="end_turn");
   if(!finished){
    if(session.stop_reason&&["awaiting_input","awaiting_approval","budget_paused","interrupted","max_iterations","context_exhausted","awaiting_answer"].includes(session.stop_reason))await pool.query("UPDATE advocacy_document_extractions SET error_code=$2 WHERE document_id=$1 AND state='running'",[id,`READER_${session.stop_reason.toUpperCase()}`]);
    if(["failed","cancelled"].includes(session.status)||session.stop_reason==="error")await pool.query("UPDATE advocacy_document_extractions SET state='failed',error_code='READER_FAILED' WHERE document_id=$1 AND state='running'",[id]);
    return c.json({state:session.status,stop_reason:session.stop_reason});
   }
   const parsed=extractionOutput.safeParse(session.structured_output);
   if(!parsed.success||session.pending_actions.length||row.file_id&&!await verifyImageRead(session.id,row.file_id)){
    await pool.query("UPDATE advocacy_document_extractions SET state='failed',error_code='UNVERIFIED_READER_OUTPUT' WHERE document_id=$1 AND state='running'",[id]);
    return c.json({error:"The reader did not return a verified transcription. No evidence was added."},422);
   }
   await pool.query("UPDATE advocacy_document_extractions SET state='ready',result=$2,error_code=NULL WHERE document_id=$1 AND state='running'",[id,JSON.stringify(parsed.data)]);
   return c.json({state:"ready",result:parsed.data,confirmed_at:null});
  }catch{return c.json({error:"Reader status is unavailable. The existing run is preserved; refresh it again."},502);}
 });
 app.post("/confirm",async c=>{
  const parsed=z.object({confirm:z.literal(true)}).safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({error:"Review the transcription and explicitly confirm it."},400);
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   const owner=await client.query("SELECT id FROM advocacy_cases WHERE id=$1 AND owner_id=$2 FOR UPDATE",[c.req.param("id"),c.get("userId")]);
   if(!owner.rowCount){await client.query("ROLLBACK");return c.json({error:"Case not found."},404);}
   const {rows:[row]}=await client.query("SELECT * FROM advocacy_document_extractions WHERE document_id=$1 FOR UPDATE",[c.req.param("documentId")]);
   if(!row||row.state!=="ready"||!extractionOutput.safeParse(row.result).success){await client.query("ROLLBACK");return c.json({error:"A completed transcription is required."},409);}
   if(!row.confirmed_at){
    await client.query("UPDATE advocacy_document_extractions SET confirmed_at=now() WHERE document_id=$1",[c.req.param("documentId")]);
    await client.query("UPDATE advocacy_cases SET revision=revision+1,analysis=NULL,status='new' WHERE id=$1",[c.req.param("id")]);
   }
   await client.query("COMMIT");return c.json({confirmed:true});
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 });
 return app;
}
