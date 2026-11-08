import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {and,desc,eq,sql,or} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {Hono} from 'hono';
import {z} from 'zod';
import {agentmailEvents,emailLeads,caseMailboxes,cases,outreachActions,caseAuthorities} from './schema';
import {mailbox,normalizeReply} from './providers/replies';
import {syncReplies} from './reply-service';
import {queueCaseAgentEvent} from './case-agent-events';
import {sendVerifiedEmailCaseMessage} from './case-messages';
import {resumeCaseAuthority} from './autonomy-service';
import {isOpenCasePermission} from './open-case-policy';
import {submitCase} from './intake-service';
import {queueEmailAttachments} from './email-attachments';
import {queueFirmEvent} from './firm-events';

export const AGENTMAIL_EVENT_TYPES=['message.received','message.received.spam','message.received.unauthenticated','message.bounced','message.rejected'];
export function verifyAgentMailSignature(body:string,headers:Headers,secret:string,now=Date.now()){
 const id=headers.get('svix-id'),timestamp=headers.get('svix-timestamp'),signatures=headers.get('svix-signature');
 if(!id||!timestamp||!signatures||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!secret.startsWith('whsec_'))return false;
 const expected=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${timestamp}.${body}`).digest();
 return signatures.split(' ').some(part=>{const [version,value]=part.split(',');if(version!=='v1'||!value)return false;const bytes=Buffer.from(value,'base64');return bytes.length===expected.length&&timingSafeEqual(bytes,expected);});
}
const eventSchema=z.object({event_id:z.string().min(1).max(1000),event_type:z.enum(AGENTMAIL_EVENT_TYPES as [string,...string[]]),message:z.object({inbox_id:z.string().min(1),message_id:z.string().min(1),thread_id:z.string().optional(),from:z.string().optional(),to:z.array(z.string()).optional(),subject:z.string().optional(),text:z.string().optional(),extracted_text:z.string().optional(),labels:z.array(z.string()).optional(),timestamp:z.string().optional(),attachments:z.array(z.record(z.string(),z.unknown())).optional()}).passthrough()}).passthrough();
function authenticated(message:Record<string,unknown>){
 const sender=mailbox(String(message.from??'')),domain=sender?.split('@')[1],auth=message.authentication_results as Record<string,string>|undefined;
 const armor=message.agent_armor as Record<string,string>|undefined;
 return !!domain&&((auth?.dmarc==='pass'&&auth.dmarc_domain?.toLowerCase()===domain)||(auth?.dkim==='pass'&&auth.dkim_domain?.toLowerCase()===domain))&&!(message.labels as string[]|undefined)?.some(x=>['spam','blocked','unauthenticated'].includes(x))&&(!armor||(armor.status==='complete'&&armor.verdict==='clear'));
}
function messageUuid(id:string){const h=createHash('sha256').update(`agentmail:${id}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
export async function ingestAgentMailEvent(db:NodePgDatabase,input:unknown,request:typeof fetch=fetch){
 const envelope=z.record(z.string(),z.unknown()).parse(input);
 const event=eventSchema.parse({...envelope,message:envelope.message??envelope.bounce??envelope.reject}),m=event.message;
 const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 if(m.inbox_id!==(process.env.AGENTMAIL_PUBLIC_INBOX_ID??process.env.AGENTMAIL_INBOX_ID)&&!(await db.select({id:caseMailboxes.case_id}).from(caseMailboxes).where(eq(caseMailboxes.inbox_id,m.inbox_id))).length)return {ignored:true};
 if(event.event_type.startsWith('message.received')&&!m.text&&!m.extracted_text&&m.body_url){
  const key=process.env.AGENTMAIL_API_KEY;if(!key)throw Error('AGENTMAIL_NOT_CONFIGURED');
  const response=await request(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(m.inbox_id)}/messages/${encodeURIComponent(m.message_id)}`,{headers:{Authorization:`Bearer ${key}`},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`MESSAGE_READ_HTTP_${response.status}`);
  const reader=response.body?.getReader();if(!reader)throw Error('MESSAGE_READ_EMPTY');let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2*1024*1024)throw Error('MESSAGE_READ_TOO_LARGE');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  const retrieved=z.object({inbox_id:z.string(),message_id:z.string(),text:z.string().optional(),extracted_text:z.string().optional()}).parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  if(retrieved.inbox_id!==m.inbox_id||retrieved.message_id!==m.message_id)throw Error('MESSAGE_READ_MISMATCH');
  if(!retrieved.text&&!retrieved.extracted_text)throw Error('MESSAGE_BODY_UNAVAILABLE');
  m.text=retrieved.text;m.extracted_text=retrieved.extracted_text;
 }
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${event.event_id},0))`);
  const [existing]=await tx.select().from(agentmailEvents).where(eq(agentmailEvents.event_id,event.event_id));
  if(existing){if(existing.payload_hash!==hash)throw Error('EVENT_CONTENT_CONFLICT');return {duplicate:true,state:existing.state};}
  const [mapping]=await tx.select().from(caseMailboxes).where(eq(caseMailboxes.inbox_id,m.inbox_id));
  const publicInbox=process.env.AGENTMAIL_PUBLIC_INBOX_ID??process.env.AGENTMAIL_INBOX_ID;
  if(!mapping&&m.inbox_id!==publicInbox)return {ignored:true};
  // In the shared inbox, a thread this firm started belongs to its case. Anything else is a new lead.
  const threadMatch=mapping?null:(await tx.select({case_id:outreachActions.case_id}).from(outreachActions).where(and(eq(outreachActions.kind,'email'),eq(outreachActions.provider_inbox_id,m.inbox_id),m.thread_id?or(eq(outreachActions.provider_thread_id,m.thread_id),eq(outreachActions.provider_id,m.message_id)):eq(outreachActions.provider_id,m.message_id))).limit(1))[0];
  const route=mapping??(threadMatch?{case_id:threadMatch.case_id,inbox_id:m.inbox_id,email:process.env.AGENTMAIL_PUBLIC_EMAIL??m.inbox_id,client_email:null,client_email_verified_at:null}:null);
  const body=(m.extracted_text?.trim()?m.extracted_text:m.text??'').trim();
  let leadId:string|undefined,state='recorded';
  if(!route&&event.event_type.startsWith('message.received')){
   const sender=mailbox(m.from??'');if(!sender)throw Error('INVALID_SENDER');
   const [lead]=await tx.insert(emailLeads).values({inbox_id:m.inbox_id,message_id:m.message_id,sender,subject:m.subject??'',body,attachments:m.attachments??[],state:event.event_type==='message.received'&&authenticated(m)?'new':'held'}).onConflictDoNothing().returning();
   leadId=lead?.id??(await tx.select().from(emailLeads).where(and(eq(emailLeads.inbox_id,m.inbox_id),eq(emailLeads.message_id,m.message_id))))[0]?.id;state='lead';
   if(lead)await queueFirmEvent(tx,{role:'frontdesk',event_key:`email-lead:${lead.id}`,kind:'new_email_lead',payload:{lead_id:lead.id,held:lead.state==='held'}});
  }
  if(route){
   if(m.attachments?.length)await queueEmailAttachments(tx,{caseId:route.case_id,inboxId:m.inbox_id,messageId:m.message_id,attachments:m.attachments,held:event.event_type!=='message.received'||!authenticated(m)});
   const [item]=await tx.select().from(cases).where(eq(cases.id,route.case_id));
   if(!item)throw Error('CASE_NOT_FOUND');
   if(event.event_type==='message.received'&&route.client_email_verified_at&&mailbox(m.from??'')===mailbox(route.client_email??'')&&authenticated(m)&&m.to?.some(to=>mailbox(to)===mailbox(route.email))&&(body||m.attachments?.length)){
    if(body)await sendVerifiedEmailCaseMessage(tx,item.id,item.owner_id,{id:messageUuid(m.message_id),text:body});
    else{
     await queueCaseAgentEvent(tx,item.id,`owner-email-attachments:${m.message_id}`,'claimant_updated_case',{message_id:m.message_id,attachment_count:m.attachments?.length,source:'verified_owner_email'});
     const [authority]=await tx.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,item.id)).orderBy(desc(caseAuthorities.approved_at)).limit(1);
     if(authority&&isOpenCasePermission(authority.policy)&&authority.state==='human_required')try{await tx.transaction(nested=>resumeCaseAuthority(nested,item.id,authority.id,item.owner_id));}catch(error){if(!(error instanceof Error)||!['RUN_BUSY','UNRESOLVED_DISPATCH','PERMISSION_ENDED','NOT_RESUMABLE'].includes(error.message))throw error;}
    }state='owner_message';
   }else{
    const actions=await tx.select().from(outreachActions).where(eq(outreachActions.case_id,item.id));
    const action=actions.find(a=>a.kind==='email'&&((m.thread_id&&a.provider_thread_id===m.thread_id)||a.provider_id===m.message_id));
    if(action&&['message.bounced','message.rejected'].includes(event.event_type))await tx.update(outreachActions).set({provider_status:event.event_type,checked_at:new Date()}).where(eq(outreachActions.id,action.id));
    if(action&&event.event_type.startsWith('message.received')&&m.thread_id&&m.timestamp&&m.from){
     const reply=normalizeReply({...m,thread_id:m.thread_id,timestamp:m.timestamp,from:m.from,to:m.to??[],labels:[...(m.labels??[]),'received',...(event.event_type==='message.received'?[]:[event.event_type.split('.').at(-1)!])]} as Parameters<typeof normalizeReply>[0],action,m.inbox_id,route.email);
     if(reply)await syncReplies(tx,action,item.owner_id,async()=>({replies:[reply],partial:false}));
    }
    await queueCaseAgentEvent(tx,item.id,`agentmail:${event.event_id}`,event.event_type,{message_id:m.message_id,thread_id:m.thread_id,source:'agentmail',trusted_owner:false});state='case_evidence';
   }
  }
  await tx.insert(agentmailEvents).values({event_id:event.event_id,payload_hash:hash,event_type:event.event_type,inbox_id:m.inbox_id,message_id:m.message_id,payload:event,state,case_id:route?.case_id,lead_id:leadId,processed_at:new Date()});
  return {state,lead_id:leadId};
 });
}
export function agentmailWebhookRoutes(db:NodePgDatabase){
 return new Hono().post('/',async c=>{
  const secret=process.env.AGENTMAIL_WEBHOOK_SECRET;if(!secret)return c.json({error:'Webhook unavailable'},503);
  const raw=await c.req.text();if(Buffer.byteLength(raw)>1024*1024)return c.json({error:'Payload too large'},413);
  if(!verifyAgentMailSignature(raw,c.req.raw.headers,secret))return c.json({error:'Invalid signature'},401);
  try{return c.json(await ingestAgentMailEvent(db,JSON.parse(raw)));}catch(error){if(error instanceof z.ZodError||error instanceof SyntaxError)return c.json({error:'Invalid event'},400);if(error instanceof Error&&error.message==='EVENT_CONTENT_CONFLICT')return c.json({error:'Event conflict'},409);console.error('AgentMail ingestion failed',error instanceof Error?error.name:'Error');return c.json({error:'Retry delivery'},503);}
 });
}
export async function claimEmailLead(db:NodePgDatabase,input:{leadId:string;ownerId:string;verifiedEmail:string;emailVerified:boolean;caseType?:'workplace_injury'|'health_insurance'}){
 if(!input.emailVerified)throw Error('VERIFIED_EMAIL_REQUIRED');
 if(!input.caseType)throw Error('CLARIFY_CASE_TYPE');
 return db.transaction(async tx=>{
  const [lead]=await tx.select().from(emailLeads).where(eq(emailLeads.id,input.leadId)).for('update');
  if(!lead||mailbox(input.verifiedEmail)!==mailbox(lead.sender))throw Error('NOT_FOUND');
  if(lead.case_id){if(lead.claimed_owner!==input.ownerId)throw Error('NOT_FOUND');return {id:lead.case_id,agent_started:true};}
  const created=await submitCase(tx,input.ownerId,{title:lead.subject.trim().slice(0,120)||'Email case',case_type:input.caseType,intake:{contact_email:lead.sender,injury_description:lead.body.slice(0,4000)},notes:lead.body.slice(0,8000)},true);
  await tx.update(emailLeads).set({case_id:created.id,claimed_owner:input.ownerId,state:'claimed'}).where(eq(emailLeads.id,lead.id));
  await tx.update(agentmailEvents).set({case_id:created.id}).where(eq(agentmailEvents.lead_id,lead.id));
  await queueEmailAttachments(tx,{caseId:created.id,inboxId:lead.inbox_id,messageId:lead.message_id,attachments:lead.attachments});
  if(lead.body)await sendVerifiedEmailCaseMessage(tx,created.id,input.ownerId,{id:messageUuid(`claimed:${lead.id}`),text:lead.body});
  return created;
 });
}
export async function ensureCaseInbox(db:NodePgDatabase,input:{caseId:string;clientEmail?:string;clientEmailVerified?:boolean},request:typeof fetch=fetch){
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(eq(cases.id,input.caseId)).for('update');if(!item)throw Error('CASE_NOT_FOUND');
  const [existing]=await tx.select().from(caseMailboxes).where(eq(caseMailboxes.case_id,item.id));if(existing)return existing;
  const key=process.env.AGENTMAIL_API_KEY;if(!key)throw Error('AGENTMAIL_NOT_CONFIGURED');
  const response=await request('https://api.agentmail.to/v0/inboxes',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({client_id:`assurance-case-${item.id}`,display_name:'Assurance advocate'}),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)throw Error(`INBOX_CREATE_HTTP_${response.status}`);
  const remote=z.object({inbox_id:z.string().min(1),email:z.email()}).parse(await response.json());
  const [saved]=await tx.insert(caseMailboxes).values({case_id:item.id,...remote,client_email:input.clientEmail?mailbox(input.clientEmail):null,client_email_verified_at:input.clientEmailVerified?new Date():null}).returning();return saved;
 });
}

/** Reserve before dispatch; a missing receipt is never automatically sent again. */
export async function sendLeadInvitation(db:NodePgDatabase,leadId:string,input:{operationId:string;text:string;subject?:string},request:typeof fetch=fetch){
 z.object({operationId:z.string().min(1).max(160),text:z.string().min(1).max(16000),subject:z.string().max(500).optional()}).parse(input);
 const id=`lead-invitation:${leadId}:${input.operationId}`,hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const reserved=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`);
  const [old]=await tx.select().from(agentmailEvents).where(eq(agentmailEvents.event_id,id));
  if(old){if(old.payload_hash!==hash)throw Error('OPERATION_CONFLICT');return {old};}
  const [lead]=await tx.select().from(emailLeads).where(eq(emailLeads.id,leadId)).for('update');if(!lead)throw Error('NOT_FOUND');
  if(lead.state==='held')throw Error('LEAD_REQUIRES_AUTHENTICATED_CLAIM');
  await tx.insert(agentmailEvents).values({event_id:id,payload_hash:hash,event_type:'invitation',inbox_id:lead.inbox_id,message_id:lead.message_id,payload:{text:input.text,subject:input.subject??'Your Assurance case',recipient:lead.sender},state:'reserved',lead_id:leadId});
  return {lead};
 });
 if(reserved.old)return {state:reserved.old.state,duplicate:true};
 const lead=reserved.lead!;
 try{
  const key=process.env.AGENTMAIL_API_KEY;if(!key)throw Error('AGENTMAIL_NOT_CONFIGURED');
  const response=await request(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(lead.inbox_id)}/messages/send`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({to:[lead.sender],subject:input.subject??'Your Assurance case',text:input.text}),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)throw Error(`INVITATION_HTTP_${response.status}`);
  const receipt=z.object({message_id:z.string().min(1),thread_id:z.string().min(1)}).parse(await response.json());
  await db.update(agentmailEvents).set({state:'sent',processed_at:new Date(),payload:{...input,...receipt}}).where(eq(agentmailEvents.event_id,id));
  return {state:'sent',...receipt};
 }catch{
  await db.update(agentmailEvents).set({state:'uncertain',error:'Dispatch did not yield a durable confirmed receipt; reconcile before sending again.'}).where(eq(agentmailEvents.event_id,id));
  return {state:'uncertain'};
 }
}
