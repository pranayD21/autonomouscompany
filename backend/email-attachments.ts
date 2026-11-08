import {createHash} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
import {and,eq,sql} from 'drizzle-orm';
import {drizzle,type NodePgDatabase} from 'drizzle-orm/node-postgres';
import type {Pool} from 'pg';
import {Hono} from 'hono';
import {z} from 'zod';
import {firmRecords,documents,cases} from './schema';
import {documentFiles,validateDocument,MAX_DOCUMENT_BYTES} from './document-storage';
import {sourceUrl,publicAddress} from './public-source';
import {queueCaseAgentEvent} from './case-agent-events';
import {extractionRoutes} from './document-extraction-routes';
const attachment=z.object({attachment_id:z.string().min(1),filename:z.string().optional(),content_type:z.string().optional(),size:z.number().optional()});
function documentId(key:string){const h=createHash('sha256').update(key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
export async function queueEmailAttachments(db:NodePgDatabase,input:{caseId:string;inboxId:string;messageId:string;attachments:Record<string,unknown>[];held?:boolean}){
 for(const raw of input.attachments){const parsed=attachment.safeParse(raw);const a=parsed.success?parsed.data:{attachment_id:`invalid-${createHash('sha256').update(JSON.stringify(raw)).digest('hex')}`},key=`email-attachment:${input.caseId}:${input.inboxId}:${input.messageId}:${a.attachment_id}`;
  await db.insert(firmRecords).values({key,kind:'email_attachment',case_id:input.caseId,actor:'agentmail',payload:{...a,inbox_id:input.inboxId,message_id:input.messageId,document_id:documentId(key),state:input.held||!parsed.success?'held':'queued',error:!parsed.success?'ATTACHMENT_METADATA_INVALID':input.held?'MESSAGE_SECURITY_HOLD':null,provenance:'unverified_email_attachment'}}).onConflictDoNothing();
  if(input.held||!parsed.success)await queueCaseAgentEvent(db,input.caseId,`email-attachment-held:${key}`,'email_attachment_held',{document_id:documentId(key),error:!parsed.success?'ATTACHMENT_METADATA_INVALID':'MESSAGE_SECURITY_HOLD'});
 }
}
export async function downloadEmailAttachment(raw:string){
 const url=sourceUrl(raw),host=url.hostname.replace(/^\[|\]$/g,''),addresses=isIP(host)?[{address:host,family:isIP(host)}]:await lookup(host,{all:true});
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('ATTACHMENT_ADDRESS_REJECTED');
 return new Promise<Uint8Array>((resolve,reject)=>{
  const req=httpsRequest({hostname:addresses[0].address,port:443,servername:isIP(host)?undefined:host,path:url.pathname+url.search,method:'GET',agent:false,signal:AbortSignal.timeout(20000),headers:{Host:url.host,'Accept-Encoding':'identity'}},res=>{
   if(res.statusCode!==200||res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.resume();reject(Error('ATTACHMENT_DOWNLOAD_REJECTED'));return;}
   const chunks:Buffer[]=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>MAX_DOCUMENT_BYTES){res.destroy(Error('ATTACHMENT_TOO_LARGE'));return;}chunks.push(chunk);});res.on('error',reject);res.on('end',()=>resolve(Buffer.concat(chunks)));
  });req.on('error',reject);req.end();
 });
}
export type EmailAttachmentDependencies={fetch:typeof fetch;download:(url:string)=>Promise<Uint8Array>;upload:(key:string,bytes:Uint8Array,mime:string)=>Promise<unknown>;extract:(caseId:string,documentId:string,owner:string)=>Promise<{state:string;error?:string}>};
function defaults(pool:Pool):EmailAttachmentDependencies{return {fetch,download:downloadEmailAttachment,upload:(key,bytes,mime)=>documentFiles().upload(key,bytes,{contentType:mime}),extract:async(caseId,id,owner)=>{
 const app=new Hono<{Variables:{userId:string}}>();app.use('*',async(c,next)=>{c.set('userId',owner);await next();});app.route('/cases/:id/documents/:documentId/extraction',extractionRoutes(pool));
 let response=await app.request(`/cases/${caseId}/documents/${id}/extraction`,{method:'POST'});let result=await response.json() as {state?:string;error?:string};if(response.ok&&result.state==='running'){response=await app.request(`/cases/${caseId}/documents/${id}/extraction/refresh`,{method:'POST'});result=await response.json() as typeof result;}return {state:result.state??'failed',error:response.ok?undefined:result.error??`EXTRACTION_HTTP_${response.status}`};
 }};}
export async function pollEmailAttachments(pool:Pool,overrides:Partial<EmailAttachmentDependencies>={}){
 const db=drizzle(pool),deps={...defaults(pool),...overrides};const jobs=await db.select().from(firmRecords).where(and(eq(firmRecords.kind,'email_attachment'),sql`${firmRecords.payload}->>'state' IN ('queued','stored')`)).limit(5);let processed=0;
 for(const job of jobs){
  let ready:{caseId:string;documentId:string;owner:string}|undefined;
  try{ready=await db.transaction(async tx=>{
   const [locked]=await tx.select().from(firmRecords).where(eq(firmRecords.key,job.key)).for('update',{skipLocked:true});if(!locked||!['queued','stored'].includes(String(locked.payload.state)))return;
   const p=locked.payload,[item]=await tx.select().from(cases).where(eq(cases.id,locked.case_id!));if(!item)throw Error('CASE_NOT_FOUND');
   const id=String(p.document_id),key=`cases/${item.id}/${id}`;
   if(p.state==='queued'){
    const token=process.env.AGENTMAIL_API_KEY;if(!token)throw Error('AGENTMAIL_NOT_CONFIGURED');
    const endpoint=`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(String(p.inbox_id))}/messages/${encodeURIComponent(String(p.message_id))}/attachments/${encodeURIComponent(String(p.attachment_id))}`;
    const response=await deps.fetch(endpoint,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`ATTACHMENT_METADATA_HTTP_${response.status}`);
    const meta=z.object({attachment_id:z.string(),size:z.number().int().positive().max(MAX_DOCUMENT_BYTES),download_url:z.string(),filename:z.string().optional(),content_type:z.string().optional()}).parse(await response.json());
    if(meta.attachment_id!==p.attachment_id)throw Error('ATTACHMENT_ID_MISMATCH');sourceUrl(meta.download_url);
    const mime=meta.content_type??String(p.content_type??''),bytes=await deps.download(meta.download_url);if(bytes.length!==meta.size)throw Error('ATTACHMENT_SIZE_MISMATCH');const hash=validateDocument(bytes,mime);
    const [prior]=await tx.select().from(documents).where(eq(documents.id,id));if(prior&&(prior.case_id!==item.id||prior.sha256!==hash||prior.mime!==mime))throw Error('ATTACHMENT_CONTENT_CONFLICT');
    if(!prior)await tx.insert(documents).values({id,case_id:item.id,object_key:key,filename:(meta.filename??String(p.filename??'email-attachment')).replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,180),mime,byte_size:bytes.length,sha256:hash,kind:'other'});
    if(prior?.state!=='ready')await deps.upload(key,bytes,mime);
    await tx.update(documents).set({state:'ready'}).where(eq(documents.id,id));
    await tx.update(firmRecords).set({payload:{...p,state:'stored',sha256:hash},updated_at:new Date()}).where(eq(firmRecords.key,job.key));
    await tx.update(cases).set({revision:sql`${cases.revision}+1`,analysis:null,status:'new'}).where(eq(cases.id,item.id));
    await queueCaseAgentEvent(tx,item.id,`email-document:${id}`,'document_ready',{document_id:id,trust:'unverified_email_attachment',message_id:p.message_id});
   }
   return {caseId:item.id,documentId:id,owner:item.owner_id};
  });
  if(ready){const result=await deps.extract(ready.caseId,ready.documentId,ready.owner);await db.update(firmRecords).set({payload:sql`${firmRecords.payload} || ${JSON.stringify({state:result.error?'held':result.state==='ready'?'complete':'stored',extraction_state:result.state,error:result.error??null})}::jsonb`,updated_at:new Date()}).where(eq(firmRecords.key,job.key));if(result.state==='ready'&&!result.error)await queueCaseAgentEvent(db,ready.caseId,`email-document-extracted:${ready.documentId}`,'document_extracted',{document_id:ready.documentId,trust:'machine_extracted_unverified'});if(result.error)await queueCaseAgentEvent(db,ready.caseId,`email-document-error:${ready.documentId}`,'email_attachment_held',{document_id:ready.documentId,error:result.error});processed++;}
  }catch(error){const code=error instanceof z.ZodError?'ATTACHMENT_METADATA_INVALID':error instanceof Error?error.message:'ATTACHMENT_FAILED';await db.update(firmRecords).set({payload:sql`${firmRecords.payload} || ${JSON.stringify({state:'held',error:code})}::jsonb`,updated_at:new Date()}).where(eq(firmRecords.key,job.key));if(job.case_id)await queueCaseAgentEvent(db,job.case_id,`email-attachment-held:${job.key}`,'email_attachment_held',{document_id:job.payload.document_id,error:code});}
 }
 return {processed};
}
