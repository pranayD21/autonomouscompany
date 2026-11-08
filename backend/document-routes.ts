import {readPdfText} from "./providers/document-reader";
import {enqueueDocumentNotice} from "./phone-messaging";
import {drizzle} from "drizzle-orm/node-postgres";
import {queueCaseAgentEvent} from "./case-agent-events";
import {extractionRoutes} from "./document-extraction-routes";
import { Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";
import { documentFiles, validateDocument } from "./document-storage";
import type { CaseDocument } from "./schema";

export function documentRoutes(pool: Pool) {
  const app = new Hono<{Variables:{userId:string}}>();
  app.use("*",async(c,next)=>{
    const id=c.req.param("id");
    if(!z.uuid().safeParse(id).success)return c.json({error:"Case not found."},404);
    const result=await pool.query("SELECT id FROM advocacy_cases WHERE id=$1 AND owner_id=$2",[id,c.get("userId")]);
    if(!result.rowCount)return c.json({error:"Case not found."},404);
    await next();
  });
  app.route("/:documentId/extraction",extractionRoutes(pool));
  app.get("/",async c=>{
    const result=await pool.query<CaseDocument>("SELECT d.*, e.state AS extraction_state, e.result AS extraction_result, e.error_code AS extraction_error, e.confirmed_at FROM advocacy_documents d LEFT JOIN advocacy_document_extractions e ON e.document_id=d.id WHERE d.case_id=$1 ORDER BY d.created_at",[c.req.param("id")]);
    return c.json(result.rows.map(({object_key,...doc})=>doc));
  });
  app.post("/",async c=>{
    const form=await c.req.formData();
    const id=form.get("id"),file=form.get("file"),kind=form.get("kind");
    if(!z.uuid().safeParse(id).success || !(file instanceof File) || !["insurance_card","bill","eob","incident","other"].includes(String(kind)))return c.json({error:"Provide a document ID, file, and document type."},400);
    const bytes=new Uint8Array(await file.arrayBuffer());let hash:string;
    try{hash=validateDocument(bytes,file.type);}catch(e){await enqueueDocumentNotice(pool,c.req.param("id")!,String(id),"INVALID_UPLOAD").catch(()=>{});return c.json({error:(e as Error).message},400);}
    const filename=file.name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,180)||"document";
    const caseId=c.req.param("id");const key=`cases/${caseId}/${id}`;
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const owner=await client.query("SELECT id FROM advocacy_cases WHERE id=$1 AND owner_id=$2 FOR UPDATE",[caseId,c.get("userId")]);
      if(!owner.rowCount){await client.query("ROLLBACK");return c.json({error:"Case not found."},404);}
      const existing=await client.query<CaseDocument>("SELECT * FROM advocacy_documents WHERE id=$1",[id]);
      if(existing.rowCount){
        const d=existing.rows[0];
        if(d.case_id!==caseId||d.sha256!==hash||d.kind!==kind||d.mime!==file.type){await client.query("ROLLBACK");return c.json({error:"That upload ID is already used. Select the file again to start a new upload."},409);}
        if(d.state==="ready"){await client.query("COMMIT");return c.json({id:d.id,state:d.state});}
      }else{
        const count=await client.query("SELECT count(*)::int AS count FROM advocacy_documents WHERE case_id=$1",[caseId]);
        if(count.rows[0].count>=20){await client.query("ROLLBACK");return c.json({error:"Each case supports up to 20 documents."},409);}
        await client.query("INSERT INTO advocacy_documents(id,case_id,object_key,filename,mime,byte_size,sha256,kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[id,caseId,key,filename,file.type,bytes.length,hash,kind]);
      }
      await client.query("COMMIT");
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
    // Concurrent retries can only write the same validated bytes to this reserved key.
    await documentFiles().upload(key,bytes,{contentType:file.type});
    const finish=await pool.connect();
    try{
      await finish.query("BEGIN");
      await finish.query("SELECT id FROM advocacy_cases WHERE id=$1 FOR UPDATE",[caseId]);
      const changed=await finish.query("UPDATE advocacy_documents SET state='ready' WHERE id=$1 AND state='uploading' RETURNING id",[id]);
      if(changed.rowCount){await finish.query("UPDATE advocacy_cases SET revision=revision+1,analysis=NULL,status='new' WHERE id=$1",[caseId]);await queueCaseAgentEvent(drizzle(finish),caseId!,`document:${id}`,"document_ready",{document_id:id});}
      await finish.query("COMMIT");
    }catch(e){await finish.query("ROLLBACK");throw e;}finally{finish.release();}
    if(process.env.PHONE_FLOW_ENABLED==="true"&&file.type==="application/pdf"){
      try{await readPdfText(bytes);}catch(e){
        const code=e instanceof Error&&["PDF_NO_TEXT","PDF_PAGE_LIMIT","PDF_TEXT_LIMIT"].includes(e.message)?e.message:"DOCUMENT_READ_FAILED";
        await pool.query("INSERT INTO advocacy_document_extractions(document_id,state,error_code) VALUES($1,'failed',$2) ON CONFLICT DO NOTHING",[id,code]);
        await enqueueDocumentNotice(pool,caseId!,String(id),code).catch(()=>{});
      }
    }
    return c.json({id,state:"ready"},201);
  });
  app.get("/:documentId/download",async c=>{
    if(!z.uuid().safeParse(c.req.param("documentId")).success)return c.json({error:"Document not found."},404);
    const result=await pool.query<CaseDocument>("SELECT * FROM advocacy_documents WHERE id=$1 AND case_id=$2 AND state='ready'",[c.req.param("documentId"),c.req.param("id")]);
    const doc=result.rows[0];if(!doc)return c.json({error:"Document not found."},404);
    const bytes=new Uint8Array(await(await documentFiles().download(doc.object_key)).arrayBuffer());
    c.header("Content-Type",doc.mime);c.header("X-Content-Type-Options","nosniff");
    c.header("Content-Disposition",`attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`);
    return c.body(bytes);
  });
  return app;
}
