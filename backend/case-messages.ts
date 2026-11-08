import {and,desc,eq,inArray,sql} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {z} from 'zod';
import {caseMessages,cases,caseAuthorities,caseDecisions,caseToolCredentials,directCaseRuns,caseAgentSessions,caseAgentSetups} from './schema';
import {queueCaseAgentEvent} from './case-agent-events';
import {resumeCaseAuthority} from './autonomy-service';
import {isOpenCasePermission} from './open-case-policy';
import type {CaseToolIdentity} from './case-tools';
import type {PhoneDocumentRequest} from './phone-document-request';
export const ownerMessageInput=z.object({id:z.uuid(),text:z.string().trim().min(1).max(4000)}).strict();
export type ChatMessage={id:string;role:'user'|'assistant';text:string;created_at:Date;kind:string};
export async function readCaseConversation(db:NodePgDatabase,caseId:string){
 const saved=await db.select().from(caseMessages).where(eq(caseMessages.case_id,caseId));
 const decisions=await db.select({id:caseDecisions.id,decision:caseDecisions.decision,created_at:caseDecisions.created_at}).from(caseDecisions).innerJoin(caseAuthorities,eq(caseAuthorities.id,caseDecisions.authority_id)).where(eq(caseAuthorities.case_id,caseId));
 const messages:ChatMessage[]=saved.map(m=>({id:m.id,role:m.role,text:m.body,created_at:m.created_at,kind:m.kind}));
 for(const d of decisions){const action=d.decision;let text:string|undefined;
  if(action?.tool==='request_human_help')text=action.question;
  if(action?.tool==='stop_case')text=action.summary;
  if(action?.tool==='wait_for_reply')text=action.reason;
  if(text&&action)messages.push({id:`decision:${d.id}`,role:'assistant',text,created_at:d.created_at,kind:action.tool});
 }
 return messages.sort((a,b)=>a.created_at.getTime()-b.created_at.getTime()||a.id.localeCompare(b.id));
}
export async function readCaseMessages(db:NodePgDatabase,caseId:string,owner:string){
 const [item]=await db.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,owner)));if(!item)throw Error('NOT_FOUND');
 const [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,caseId)).orderBy(desc(caseAuthorities.approved_at)).limit(1);
 const direct=authority?await db.select().from(directCaseRuns).where(eq(directCaseRuns.authority_id,authority.id)):[];
 const naive=authority?await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.authority_id,authority.id)):[];
 const setup=authority?await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.authority_id,authority.id)):[];
 const run=direct.find(r=>r.state!=='migrated')??naive[0];
 const state=!authority?'saved':['revoked','stopped'].includes(authority.state)?'stopped':authority.state==='human_required'?'human_required':run?.state??(setup[0]?.state==='queued'?'queued':'saved');
 return {messages:await readCaseConversation(db,caseId),state,waiting_on:authority?.reason??run?.reason??null,can_send:true};
}
export async function sendCaseMessage(db:NodePgDatabase,caseId:string,owner:string,raw:unknown){
 return persistOwnerMessage(db,caseId,owner,ownerMessageInput.parse(raw));
}
// Called only after the AgentMail webhook verifies the bound client's sender.
export async function sendVerifiedEmailCaseMessage(db:NodePgDatabase,caseId:string,owner:string,raw:unknown){
 const input=z.object({id:z.uuid(),text:z.string().min(1).max(2*1024*1024)}).strict().parse(raw);
 return persistOwnerMessage(db,caseId,owner,input);
}
async function persistOwnerMessage(db:NodePgDatabase,caseId:string,owner:string,input:{id:string;text:string}){
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,owner))).for('update');if(!item)throw Error('NOT_FOUND');
  const [prior]=await tx.select().from(caseMessages).where(eq(caseMessages.id,input.id));
  if(prior){if(prior.case_id!==caseId||prior.role!=='user'||prior.body!==input.text)throw Error('UPDATE_CONFLICT');return {saved:true,resumed:false,message_id:prior.id};}
  await tx.insert(caseMessages).values({id:input.id,case_id:caseId,role:'user',body:input.text});
  await tx.update(cases).set({revision:sql`${cases.revision}+1`,analysis:null,status:'new'}).where(eq(cases.id,caseId));
  await queueCaseAgentEvent(tx,caseId,`owner_answer:${input.id}`,'claimant_updated_case',{text:input.text,message_id:input.id,revision:item.revision+1});
  const [authority]=await tx.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,caseId)).orderBy(desc(caseAuthorities.approved_at)).limit(1);
  let resumed=false;
  if(authority&&isOpenCasePermission(authority.policy)&&['active','waiting','human_required'].includes(authority.state)){
   const [direct]=await tx.select().from(directCaseRuns).where(and(eq(directCaseRuns.authority_id,authority.id),eq(directCaseRuns.state,'human_required')));
   const [naive]=await tx.select().from(caseAgentSessions).where(and(eq(caseAgentSessions.authority_id,authority.id),eq(caseAgentSessions.state,'human_required')));
   if(direct||naive)try{await tx.transaction(async nested=>resumeCaseAuthority(nested,caseId,authority.id,owner));resumed=true;}catch(error){if(!(error instanceof Error)||!['RUN_BUSY','UNRESOLVED_DISPATCH','PERMISSION_ENDED','NOT_RESUMABLE'].includes(error.message))throw error;}
  }
  // A working or idle advocate picks this up on the scheduler's next pass, not at its next routine check.
  if(authority)await tx.update(caseAgentSessions).set({next_check_at:new Date()}).where(and(eq(caseAgentSessions.authority_id,authority.id),inArray(caseAgentSessions.state,['running','idle'])));
  return {saved:true,resumed,message_id:input.id};
 });
}
async function authorizeAgentMessage(db:NodePgDatabase,identity:CaseToolIdentity,authorityId?:string){
 const [item]=await db.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id))).for('update');
 const [credential]=await db.select().from(caseToolCredentials).where(and(eq(caseToolCredentials.id,identity.id),eq(caseToolCredentials.case_id,identity.case_id),eq(caseToolCredentials.issued_by,identity.owner_id)));
 if(!item||!credential?.authority_id||credential.revoked_at||(credential.expires_at&&credential.expires_at<=new Date())||authorityId&&authorityId!==credential.authority_id)throw Error('MESSAGE_NOT_AUTHORIZED');
 const [authority]=await db.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,credential.authority_id),eq(caseAuthorities.case_id,item.id),eq(caseAuthorities.approved_by,identity.owner_id))).for('update');
 if(!authority||!isOpenCasePermission(authority.policy)||!['active','waiting'].includes(authority.state))throw Error('MESSAGE_NOT_AUTHORIZED');
 return item;
}
export async function postAgentCaseMessage(db:NodePgDatabase,identity:CaseToolIdentity,input:{operation_id:string;text:string;kind?:string}){
 const parsed=z.object({operation_id:z.uuid(),text:z.string().trim().min(1).max(4000),kind:z.enum(['message','update']).default('message')}).parse(input);
 return db.transaction(async tx=>{
  await authorizeAgentMessage(tx,identity);
  const [prior]=await tx.select().from(caseMessages).where(eq(caseMessages.id,parsed.operation_id));
  if(prior){if(prior.case_id!==identity.case_id||prior.role!=='assistant'||prior.body!==parsed.text||prior.kind!==parsed.kind||prior.credential_id!==identity.id)throw Error('OPERATION_CONFLICT');return {id:prior.id,state:'saved',channel:'web'};}
  const [saved]=await tx.insert(caseMessages).values({id:parsed.operation_id,case_id:identity.case_id,role:'assistant',body:parsed.text,kind:parsed.kind,credential_id:identity.id}).returning();
  return {id:saved.id,state:'saved',channel:'web'};
 });
}
export async function requestCaseDocument(db:NodePgDatabase,identity:CaseToolIdentity,input:{operation_id:string;authority_id:string;kind?:PhoneDocumentRequest["kind"];document_type?:string;message?:string}){
 const parsed=z.object({operation_id:z.uuid(),authority_id:z.uuid(),kind:z.enum(['insurance_card','bill','eob','incident']).optional(),document_type:z.string().trim().min(1).max(200).optional(),message:z.string().trim().min(1).max(4000).optional()}).refine(v=>!!v.kind||!!v.document_type&&!!v.message).parse(input);
 return db.transaction(async tx=>{
  await authorizeAgentMessage(tx,identity,parsed.authority_id);
  const documentType=parsed.document_type??parsed.kind!;const authoredMessage=parsed.message??`Please upload your ${documentType.replaceAll('_',' ')} using Attach document in this conversation.`;const key=`document:${documentType.toLowerCase()}`;
  const [priorOperation]=await tx.select().from(caseMessages).where(eq(caseMessages.id,parsed.operation_id));
  if(priorOperation&&(priorOperation.case_id!==identity.case_id||priorOperation.dedupe_key!==key||priorOperation.role!=='assistant'||priorOperation.body!==authoredMessage))throw Error('OPERATION_CONFLICT');
  const [prior]=await tx.select().from(caseMessages).where(and(eq(caseMessages.case_id,identity.case_id),eq(caseMessages.dedupe_key,key)));
  if(prior)return {id:prior.id,state:'saved',channel:'web',kind:documentType};
  const [saved]=await tx.insert(caseMessages).values({id:parsed.operation_id,case_id:identity.case_id,role:'assistant',body:authoredMessage,kind:`document_request:${documentType}`,dedupe_key:key,credential_id:identity.id}).returning();
  return {id:saved.id,state:'saved',channel:'web',kind:documentType};
 });
}
