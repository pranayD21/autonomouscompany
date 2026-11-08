import {outreachRestricted} from './providers/outreach';
import {createHash} from 'node:crypto';
import {and,eq,sql} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {z} from 'zod';
import {cases,caseAuthorities,caseAgentSessions,caseToolCredentials,firmRecords} from './schema';
import type {CaseToolIdentity} from './case-tools';
import {firmNaive} from './firm-service';
import {isOpenCasePermission} from './open-case-policy';
export type PortalProvider=(method:string,path:string,body?:unknown,key?:string)=>Promise<any>;
const root='/v1/computers/';
const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('goto'),url:z.url()}),z.object({action:z.literal('observe'),instruction:z.string().max(4096).optional()}),
 z.object({action:z.literal('extract'),instruction:z.string().max(4096).optional()}),z.object({action:z.literal('click'),selector:z.string().min(1)}),
 z.object({action:z.literal('type'),selector:z.string().min(1),text:z.string().max(16000)})]);
export const portalActionInput=z.object({operation_id:z.uuid(),action:actionSchema});
const key=(caseId:string)=>`case-portal:${caseId}`;
async function binding(db:NodePgDatabase,identity:CaseToolIdentity){
 const [item]=await db.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id)));
 const [credential]=await db.select().from(caseToolCredentials).where(and(eq(caseToolCredentials.id,identity.id),eq(caseToolCredentials.case_id,identity.case_id),eq(caseToolCredentials.issued_by,identity.owner_id)));
 if(!item||!credential?.authority_id||credential.revoked_at||credential.expires_at&&credential.expires_at<=new Date())throw Error('PORTAL_ACCESS_ENDED');
 const [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,credential.authority_id));
 const [run]=await db.select().from(caseAgentSessions).where(and(eq(caseAgentSessions.authority_id,credential.authority_id),eq(caseAgentSessions.credential_id,credential.id)));
 if(!authority||authority.approved_by!==identity.owner_id||!['active','waiting'].includes(authority.state)||!isOpenCasePermission(authority.policy)||!authority.policy.consent.includes('complete and submit relevant claim forms and evidence through authorized portals')||!run)throw Error('PORTAL_SCOPE_REQUIRED');
 return {item,run,authority};
}
export function portalOrigin(raw:string){const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||url.hostname==='localhost'||/^[\d.:]+$/.test(url.hostname)||/\.(local|internal|localhost)$/.test(url.hostname))throw Error('PUBLIC_HTTPS_PORTAL_REQUIRED');return url.origin;}
async function record(db:NodePgDatabase,identity:CaseToolIdentity){await binding(db,identity);const [r]=await db.select().from(firmRecords).where(eq(firmRecords.key,key(identity.case_id)));if(!r||r.actor!==identity.owner_id||r.payload.authority_id!==(await binding(db,identity)).authority.id)throw Error('PORTAL_NOT_CONNECTED');return r;}
async function once(db:NodePgDatabase,identity:CaseToolIdentity,id:string,input:unknown,act:()=>Promise<any>){
 z.uuid().parse(id);const op=`portal-operation:${identity.case_id}:${id}`,fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const reserved=await db.transaction(async tx=>{await binding(tx,identity);await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key(identity.case_id)},0))`);
 const [prior]=await tx.select().from(firmRecords).where(eq(firmRecords.key,op));if(prior){if(prior.payload.fingerprint!==fingerprint)throw Error('PORTAL_OPERATION_CONFLICT');return {prior};}
 const unresolved=await tx.execute(sql`SELECT key FROM advocacy_firm_records WHERE case_id=${identity.case_id} AND kind='portal_operation' AND payload->>'state'='uncertain' LIMIT 1`);if(unresolved.rows.length)throw Error('PORTAL_RECONCILIATION_REQUIRED');
 await tx.insert(firmRecords).values({key:op,kind:'portal_operation',case_id:identity.case_id,actor:identity.owner_id,payload:{state:'uncertain',fingerprint}});return {};});
 if(reserved.prior)return reserved.prior.payload;
 await binding(db,identity); // Revocation recheck immediately before dispatch.
 const receipt=await act();await db.update(firmRecords).set({payload:{state:'completed',fingerprint,receipt},updated_at:new Date()}).where(eq(firmRecords.key,op));return {state:'completed',receipt};
}
export async function portalOpen(db:NodePgDatabase,identity:CaseToolIdentity,input:{operation_id:string;url:string},request:PortalProvider=firmNaive){
 if(outreachRestricted())throw Error('OUTREACH_RESTRICTED_BY_OWNER');
 const origin=portalOrigin(input.url),bound=await binding(db,identity),context=`assurance-${bound.authority.id}`;
 return once(db,identity,input.operation_id,{kind:'open',origin},async()=>{
 const existing=await db.select().from(firmRecords).where(eq(firmRecords.key,key(identity.case_id)));if(existing.length)throw Error('PORTAL_ALREADY_BOUND');
 const computer=await request('POST','/v1/computers',{name:context,browser:{allowed_domains:[new URL(origin).hostname],allow_writes:true,allow_extract:true,context_name:context,persist_context:true,human_login:true,solve_captchas:false,ask_actions:['signup']}});
 if(typeof computer.id!=='string')throw Error('INVALID_PORTAL_COMPUTER');
 await db.insert(firmRecords).values({key:key(identity.case_id),kind:'case_portal',case_id:identity.case_id,actor:identity.owner_id,payload:{computer_id:computer.id,context,origin,authority_id:bound.authority.id,identity_id:bound.run.identity_id,agent_id:bound.run.agent_id}});
 await request('POST',`${root}${computer.id}/browser/actions`,{action:'goto',url:input.url});return {opened:true,origin};
 });
}
export async function portalAction(db:NodePgDatabase,identity:CaseToolIdentity,raw:unknown,request:PortalProvider=firmNaive){
 if(outreachRestricted())throw Error('OUTREACH_RESTRICTED_BY_OWNER');
 const input=portalActionInput.parse(raw),r=await record(db,identity);if(input.action.action==='goto'&&portalOrigin(input.action.url)!==r.payload.origin)throw Error('PORTAL_ORIGIN_MISMATCH');
 return once(db,identity,input.operation_id,input,()=>request('POST',`${root}${r.payload.computer_id}/browser/actions`,input.action));
}
export async function portalStatus(db:NodePgDatabase,identity:CaseToolIdentity){const r=await record(db,identity);const operations=await db.select().from(firmRecords).where(and(eq(firmRecords.case_id,identity.case_id),eq(firmRecords.kind,'portal_operation')));return {origin:r.payload.origin,operations:operations.map(o=>({operation_id:o.key.split(':').at(-1),...o.payload})),trust:'browser_observation_not_independent_outcome_verification'};}
export async function portalReconcile(db:NodePgDatabase,identity:CaseToolIdentity,request:PortalProvider=firmNaive){const r=await record(db,identity);return {observation:await request('POST',`${root}${r.payload.computer_id}/browser/actions`,{action:'extract',instruction:'Read the current page status, confirmation/reference number and submission history visible here. Do not click, navigate, submit or change anything.'}),state:'reconciliation_only_no_replay',trust:'unverified_portal_observation'};}
export async function portalOwnerConnect(db:NodePgDatabase,caseId:string,owner:string,credentials:{email:string;password:string}|null,request:PortalProvider=firmNaive){
 const [run]=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.case_id,caseId));if(!run)throw Error('PORTAL_NOT_CONNECTED');const identity={id:run.credential_id,case_id:caseId,owner_id:owner};const r=await record(db,identity),base=`${root}${r.payload.computer_id}`;
 if(credentials){const parsed=z.object({email:z.email(),password:z.string().min(1)}).parse(credentials);await request('POST','/v1/browser/credentials',{identity_id:run.identity_id,service:r.payload.origin,...parsed});await binding(db,identity);await request('POST',`${base}/browser/login`,{identity_id:run.identity_id,service:r.payload.origin,url:r.payload.origin});}
 // Owner-only capability URL is never stored in the case transcript or returned by an agent tool.
 return request('GET',`${base}/browser/live-view`);
}

export async function portalOwnerReady(db:NodePgDatabase,caseId:string,owner:string,request:PortalProvider=firmNaive){
 const [run]=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.case_id,caseId));if(!run)throw Error('PORTAL_NOT_CONNECTED');const identity={id:run.credential_id,case_id:caseId,owner_id:owner},r=await record(db,identity);
 await request('POST',`${root}${r.payload.computer_id}/browser/context`,{name:r.payload.context,identity_id:run.identity_id,service:r.payload.origin});
 await binding(db,identity);
 await request('POST',`/v1/browser/contexts/${encodeURIComponent(String(r.payload.context))}/grants`,{identity_id:run.identity_id,grantee_type:'agent',grantee_id:run.agent_id});
 return {state:'connected',origin:r.payload.origin};
}
