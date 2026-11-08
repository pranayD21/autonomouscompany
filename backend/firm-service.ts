import {outreachRestricted} from './providers/outreach';
import {caseToolServices} from "./case-tool-service";
import {recordFirmTestFee} from "./firm-finance";
import {queueCaseAgentEvent} from "./case-agent-events";
import {createHash} from 'node:crypto';
import {and,desc,eq,sql} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {z} from 'zod';
import {cases,caseAuthorities,caseAgentSessions,caseAgentSetups,firmStaffing,firmEvents,firmRecords,firmOperations,emailLeads,caseOutcomes,caseMailboxes} from './schema';
import {queueFirmEvent,reserveFirmHire,type FirmRole} from './firm-events';
import {naiveClient} from './providers/naive';
import {naiveFetch} from './providers/naive-capacity';
import {openCaseToolInstructions} from './providers/case-agent';
import {ensureCaseInbox,sendLeadInvitation} from './agentmail-webhook';
import {readCaseConversation} from './case-messages';
import {firmTools,firmHarness} from './firm-blueprint';

export async function firmNaive(method:string,path:string,body?:unknown,key?:string){
 const response=await naiveFetch()(`https://api.vetta.sh${path}`,{method,headers:{Authorization:`Bearer ${process.env.NAIVE_SETUP_API_KEY}`,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok){const body=await response.json().catch(()=>null);const rawCode=body?.error?.code??body?.code;const code=typeof rawCode==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(rawCode)?rawCode:null;const error=Object.assign(Error(`NAIVE_HTTP_${response.status}${code?`_${code}`:''}`),{status:response.status,providerCode:code});throw error;}if(response.status===204)return {};return response.json();
}
export async function boardAssignee(value:string,registry=firmRegistry(),request=firmNaive){
 const id=registry[value]?.agent_id??(value.startsWith('agt_')?value:null);
 if(!id)return value;
 const agent=await request('GET',`/v1/agents/${encodeURIComponent(id)}`);
 return z.string().min(1).max(128).parse(agent.name);
}
export function firmRegistry(){return JSON.parse(process.env.ASSURANCE_FIRM_REGISTRY??'{}') as Record<string,{agent_id:string;identity_id:string;version?:number}>;}
async function once(db:NodePgDatabase,role:FirmRole,tool:string,id:string,input:unknown,act:()=>Promise<Record<string,unknown>>){
 z.uuid().parse(id);const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const [reserved]=await db.insert(firmOperations).values({id,role,tool,fingerprint}).onConflictDoNothing().returning();
 if(!reserved){const [old]=await db.select().from(firmOperations).where(eq(firmOperations.id,id));if(old.role!==role||old.tool!==tool||old.fingerprint!==fingerprint)throw Error('OPERATION_CONFLICT');return old.state==='completed'?old.result!:{state:'uncertain',reason:'This operation already started. Reconcile before any retry.'};}
 try{const result=await act();await db.update(firmOperations).set({state:'completed',result}).where(eq(firmOperations.id,id));return result;}
 catch(error){await db.update(firmOperations).set({state:'uncertain',result:{reason:'Operation interrupted; inspect durable resources before retry.'}}).where(eq(firmOperations.id,id));throw error;}
}
async function currentCase(db:NodePgDatabase,caseId:string){
 const [item]=await db.select().from(cases).where(eq(cases.id,z.uuid().parse(caseId)));if(!item)throw Error('NOT_FOUND');return item;
}
// The agent's default stays general, so a case session pins a separate connector version. An unstarted run needs a
// connector version carrying the new budget. Reuses a published one on retry and restores the general default.
export async function fundedConnectorVersion(agentId:string,authorityId:string,amount:number):Promise<number>{
 const versions=(await firmNaive('GET',`/v1/agents/${agentId}/versions`)).data as {version:number;mcp_servers:unknown[];tools:unknown;system:string;budget:{cap_micro_usd:number;max_task_micro_usd:number};metadata:Record<string,unknown>}[];
 const connectors=versions.filter(v=>v.mcp_servers.length>0&&v.metadata.assurance_authority===authorityId).sort((a,b)=>b.version-a.version);
 const connector=connectors[0];if(!connector)throw Error('ADVOCATE_CONNECTOR_VERSION_MISSING');
 const current=await firmNaive('GET',`/v1/agents/${agentId}`);
 let published=connector.budget.max_task_micro_usd===amount?connector.version:null;
 let head=current.current_version;
 if(published===null){
  const general=current.mcp_servers.length?current.metadata.assurance_restore_version:current.current_version;
  const updated=await firmNaive('PATCH',`/v1/agents/${agentId}`,{mcp_servers:connector.mcp_servers,tools:connector.tools,system:connector.system,budget:{period:'month',cap_micro_usd:Math.max(amount,connector.budget.cap_micro_usd),max_task_micro_usd:amount},metadata:{...connector.metadata,assurance_restore_version:general},expected_version:current.current_version});
  published=updated.current_version as number;head=published;
 }
 const latest=head===current.current_version?current:await firmNaive('GET',`/v1/agents/${agentId}`);
 if(latest.mcp_servers.length){const restore=latest.metadata.assurance_restore_version;if(!Number.isSafeInteger(restore)||restore<1)throw Error('MISSING_RESTORE_VERSION');await firmNaive('POST',`/v1/agents/${agentId}/rollback`,{to_version:restore,expected_version:latest.current_version});}
 // Naïve checks a session budget against the default version's cap, not the pinned version's.
 const general=await firmNaive('GET',`/v1/agents/${agentId}`);
 if(general.budget.cap_micro_usd<amount||general.budget.max_task_micro_usd<amount)await firmNaive('PATCH',`/v1/agents/${agentId}`,{budget:{...general.budget,cap_micro_usd:Math.max(amount,general.budget.cap_micro_usd),max_task_micro_usd:Math.max(amount,general.budget.max_task_micro_usd)},expected_version:general.current_version});
 return published;
}
export async function executeFirmTool(db:NodePgDatabase,role:FirmRole,name:string,raw:Record<string,unknown>){
 if(!firmTools[role].includes(name))throw Error('ROLE_TOOL_DENIED');
 const caseId=typeof raw.case_id==='string'?raw.case_id:undefined;
 if(name==='firm_status')return {staffing:await db.select().from(firmStaffing),events:await db.select({id:firmEvents.id,role:firmEvents.role,kind:firmEvents.kind,state:firmEvents.state,case_id:firmEvents.case_id,reason:firmEvents.reason}).from(firmEvents).orderBy(desc(firmEvents.created_at)).limit(100),credit:role==='ceo'?await firmNaive('GET','/v1/credits/balance'):null,credit_note:role==='ceo'?'Current provider balance; allocations recheck available credit.':'Credit allocation belongs to the CEO; saved case allocations are in staffing.',board_id:process.env.ASSURANCE_FIRM_BOARD_ID??null,board_records:'Staffing contains durable board/card references. Use the company board tool for writes.'};
 if(name==='list_cases')return db.select({id:cases.id,title:cases.title,case_type:cases.case_type,status:cases.status,revision:cases.revision}).from(cases).orderBy(desc(cases.created_at)).limit(100);
 if(name==='read_case_summary'){
  const item=await currentCase(db,caseId!);return {case:item,evidence:await caseToolServices(db).getCase({id:item.id,case_id:item.id,owner_id:item.owner_id}),conversation:await readCaseConversation(db,item.id),authorities:await db.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,item.id)),outcomes:await db.select().from(caseOutcomes).where(eq(caseOutcomes.case_id,item.id)),staffing:(await db.select().from(firmStaffing).where(eq(firmStaffing.case_id,item.id)))[0]??null};
 }
 if(name==='list_email_leads')return (await db.select().from(emailLeads).where(eq(emailLeads.state,'new')).limit(100)).map(l=>({...l,claim_url:`https://assurance.claims/?claim_lead=${l.id}#workspace`}));
 if(name==='read_playbook'){const key=z.string().trim().min(1).parse(raw.insurer);return (await db.select().from(firmRecords).where(and(eq(firmRecords.kind,'playbook'),eq(firmRecords.key,`playbook:${key.toLowerCase()}`))))[0]??null;}
 if(name==='case_costs'){
  const item=await currentCase(db,caseId!);const sessions=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.case_id,item.id));const costs=[];for(const run of sessions)if(run.session_id){const remote=await firmNaive('GET',`/v1/sessions/${encodeURIComponent(run.session_id)}`);costs.push({session_id:remote.id,consumed_micro_usd:remote.consumed_micro_usd,budget_micro_usd:remote.budget_micro_usd,status:remote.status});}
  return {case_id:item.id,naive:costs,fees:await db.select().from(firmRecords).where(and(eq(firmRecords.case_id,item.id),eq(firmRecords.kind,'test_fee'))),real_revenue_cents:0,limitations:'AgentMail/AgentPhone and infrastructure costs are not included unless separately recorded. Test fees are not revenue.'};
 }
 const operationId=z.uuid().parse(raw.operation_id);
 return once(db,role,name,operationId,raw,async()=>{
  if(name==='open_email_lead'&&outreachRestricted())throw Error('OUTREACH_RESTRICTED_BY_OWNER');
  if(name==='open_email_lead')return sendLeadInvitation(db,z.uuid().parse(raw.lead_id),{operationId,text:z.string().trim().min(1).parse(raw.message),subject:z.string().trim().min(1).parse(raw.subject)});
  if(name==='set_case_budget'){
   const item=await currentCase(db,caseId!);const amount=z.number().int().positive().parse(raw.budget_micro_usd),reason=z.string().trim().min(1).parse(raw.reason),recovery=raw.expected_recovery_cents==null?null:z.number().int().nonnegative().parse(raw.expected_recovery_cents);
   const [staff]=await db.select().from(firmStaffing).where(eq(firmStaffing.case_id,item.id));if(!staff)throw Error('STAFFING_NOT_REQUESTED');
   const [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,staff.authority_id));if(!authority||authority.case_id!==item.id||authority.approved_by!==item.owner_id||!['active','waiting'].includes(authority.state))throw Error('AUTHORITY_NOT_ACTIVE');
   if(staff.state==='hiring'&&amount!==staff.budget_micro_usd)throw Error('HIRING_IN_PROGRESS_RETRY_BUDGET_AFTER_START');
   const [existingRun]=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.authority_id,staff.authority_id));
   if(staff.agent_id&&existingRun&&!existingRun.session_id&&staff.budget_micro_usd&&amount<staff.budget_micro_usd)throw Error('SESSION_START_PENDING_RETRY_BUDGET_AFTER_START');
   if(existingRun?.session_id){const current=await firmNaive('GET',`/v1/sessions/${existingRun.session_id}`);if(amount<current.budget_micro_usd)throw Error('PROVIDER_ONLY_SUPPORTS_BUDGET_RAISES');}
   if(staff.agent_id){const [run]=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.authority_id,staff.authority_id));
    if(run&&!run.session_id){
     const version=await fundedConnectorVersion(staff.agent_id,staff.authority_id,amount);
     await db.update(caseAgentSessions).set({agent_version:version,state:'starting',reason:null,next_check_at:new Date(),lease_id:null,lease_until:null}).where(and(eq(caseAgentSessions.id,run.id),sql`${caseAgentSessions.session_id} IS NULL`));
    }else{
     const agent=await firmNaive('GET',`/v1/agents/${staff.agent_id}`);if(amount>agent.budget.cap_micro_usd||amount>agent.budget.max_task_micro_usd)await firmNaive('PATCH',`/v1/agents/${staff.agent_id}`,{budget:{...agent.budget,cap_micro_usd:Math.max(amount,agent.budget.cap_micro_usd),max_task_micro_usd:Math.max(amount,agent.budget.max_task_micro_usd)},expected_version:agent.current_version});
     if(run?.session_id){const session=await firmNaive('GET',`/v1/sessions/${run.session_id}`);if(amount>session.budget_micro_usd)await firmNaive('PATCH',`/v1/sessions/${run.session_id}/budget`,{cap_micro_usd:amount});}
    }}
   await db.update(firmStaffing).set({budget_micro_usd:amount,expected_recovery_cents:recovery,budget_reason:reason,state:staff.state==='hiring'?'hiring':staff.agent_id?'active':'budgeted',updated_at:new Date()}).where(eq(firmStaffing.case_id,item.id));
   if(!staff.agent_id)await queueFirmEvent(db,{role:'frontdesk',event_key:`budget:${operationId}`,kind:'budget_allocated',case_id:item.id,payload:{budget_micro_usd:amount,reason}});return {case_id:item.id,budget_micro_usd:amount,reason};
  }
  if(name==='hire_advocate'){
   const item=await currentCase(db,caseId!);const [staff]=await db.select().from(firmStaffing).where(eq(firmStaffing.case_id,item.id));if(!staff)throw Error('STAFFING_NOT_REQUESTED');
   const [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,staff.authority_id));if(!authority||authority.case_id!==item.id||authority.approved_by!==item.owner_id||!['active','waiting'].includes(authority.state))throw Error('AUTHORITY_NOT_ACTIVE');
   if(!staff.budget_micro_usd){await queueFirmEvent(db,{role:'ceo',event_key:`budget-needed:${caseId}`,kind:'budget_needed',case_id:item.id});return {state:'waiting_for_ceo_budget'};}
   if(staff.state==='active'&&staff.agent_id)return {case_id:item.id,agent_id:staff.agent_id,state:'already_hired'};
   const claimed=await reserveFirmHire(db,item.id,staff.authority_id);
   if(!claimed)throw Error('HIRING_RESERVED_RECONCILE_EXISTING_RESOURCES');
   const [currentAuthority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,staff.authority_id));
   if(!currentAuthority||!['active','waiting'].includes(currentAuthority.state))throw Error('AUTHORITY_NOT_ACTIVE');
   const client=naiveClient(process.env.NAIVE_SETUP_API_KEY);const agentName=`assurance-advocate-${staff.authority_id}`;let agent=staff.agent_id?await client.agents.get(staff.agent_id):await findAdvocate(client,agentName);
   if(!agent)agent=await client.agents.create({name:agentName,harness:firmHarness(),model:process.env.ASSURANCE_FIRM_MODEL??'openai/gpt-5.4-mini',system:`You are the exclusive Assurance advocate for case ${item.id}. ${openCaseToolInstructions}`,budget:{period:'month',cap_micro_usd:staff.budget_micro_usd,max_task_micro_usd:staff.budget_micro_usd},tools:{default_config:{permission:'deny'},configs:{}},mcp_servers:[],handoffs:false,metadata:{assurance_case:item.id,assurance_authority:staff.authority_id}});
   if(agent.metadata.assurance_case!==item.id||agent.metadata.assurance_authority!==staff.authority_id)throw Error('ADVOCATE_BINDING_MISMATCH');
   await db.update(firmStaffing).set({agent_id:agent.id,state:'hiring',updated_at:new Date()}).where(eq(firmStaffing.case_id,item.id));
   const verified=item.owner_id.startsWith('phone:')?null:(await db.execute(sql`SELECT u.email FROM neon_auth."user" u WHERE u.id=${item.owner_id} AND (u."emailVerified"=true OR EXISTS(SELECT 1 FROM advocacy_firm_records r WHERE r.key='verified-email:'||u.id AND r.kind='email_verification' AND r.payload->>'email'=lower(u.email)))`)).rows[0]?.email;
   const ownerEmail=typeof verified==='string'&&z.email().safeParse(verified).success?verified.toLowerCase():undefined;
   const mailbox=await ensureCaseInbox(db,{caseId:item.id,clientEmail:ownerEmail??(item.intake.contact_email||undefined),clientEmailVerified:!!ownerEmail});
   await db.transaction(async tx=>{
    await tx.insert(firmRecords).values({key:`advocate-provision:${staff.authority_id}`,kind:'advocate_provisioning',actor:role,case_id:item.id,payload:{authority_id:staff.authority_id,agent_id:agent.id,general_version:agent.current_version,operation_id:operationId,state:'queued'}}).onConflictDoNothing();
    await tx.update(caseAgentSetups).set({state:'queued',reason:'Front Desk hired the advocate; isolated provisioning is queued.',next_check_at:new Date(),lease_id:null,lease_until:null}).where(eq(caseAgentSetups.authority_id,staff.authority_id));
   });
   return {case_id:item.id,agent_id:agent.id,inbox:mailbox.email,state:'provisioning_queued'};
  }
  if(name==='update_board_card'){
   const board=z.string().min(1).parse(process.env.ASSURANCE_FIRM_BOARD_ID);const status=z.enum(['todo','doing','blocked','done']).parse(raw.status),title=z.string().min(1).max(200).parse(raw.title),body=z.string().max(20000).parse(raw.body??'');
   const cardId=typeof raw.card_id==='string'?raw.card_id:undefined;const card=await firmNaive(cardId?'PATCH':'POST',cardId?`/v1/boards/${board}/cards/${encodeURIComponent(cardId)}`:`/v1/boards/${board}/cards`,{title,body,status,...(!cardId?{key:operationId}:{}),...(typeof raw.assignee==='string'?{assignee:await boardAssignee(raw.assignee)}:{})});
   if(caseId)await db.update(firmStaffing).set({board_id:board,board_card_id:card.id,updated_at:new Date()}).where(eq(firmStaffing.case_id,z.uuid().parse(caseId)));return {card};
  }
  if(name==='record_test_fee')return recordFirmTestFee(db,{operation_id:operationId,case_id:z.uuid().parse(caseId),outcome_id:z.uuid().parse(raw.outcome_id),fee_rate:z.number().min(0).max(1).parse(raw.fee_rate),reason:z.string().trim().min(1).parse(raw.reason)});
  const kind=name==='write_playbook'?'playbook':name==='review_case'?'review':name==='record_growth_lead'?'growth_lead':null;if(!kind)throw Error('UNKNOWN_TOOL');
  let key=`${kind}:${operationId}`,payload:Record<string,unknown>={...raw,recorded_at:new Date().toISOString()};
  if(kind==='playbook'){const insurer=z.string().trim().min(1).parse(raw.insurer);key=`playbook:${insurer.toLowerCase()}`;z.string().trim().min(1).parse(raw.content);z.array(z.string().min(1)).nonempty().parse(raw.sources);}
  if(kind==='review'){await currentCase(db,caseId!);z.string().trim().min(1).parse(raw.findings);z.array(z.string().min(1)).parse(raw.evidence_refs);}
  if(kind==='growth_lead'){z.string().trim().min(1).parse(raw.organization);z.url().parse(raw.source_url);z.string().trim().min(1).parse(raw.reason);}

  if(kind==='playbook')await db.insert(firmRecords).values({key:`playbook-revision:${operationId}`,kind:'playbook_revision',case_id:caseId,payload:{...payload,playbook_key:key},actor:role}).onConflictDoNothing();
  await db.insert(firmRecords).values({key,kind,case_id:caseId,payload,actor:role}).onConflictDoUpdate({target:firmRecords.key,set:{payload,actor:role,updated_at:new Date()}});if(kind==='review'&&caseId)await queueCaseAgentEvent(db,caseId,`company-review:${operationId}`,'company_review',{record_key:key,findings:payload.findings,evidence_refs:payload.evidence_refs,trust:'agent_review_not_independent_verification'});return {key,...payload};
 });
}

async function findAdvocate(client:ReturnType<typeof naiveClient>,name:string){
 let after:string|undefined;const seen=new Set<string>();let found;
 do{const page=await client.agents.list({limit:100,...(after?{after}:{})});for(const a of page.data)if(a.name===name){if(found)throw Error('AMBIGUOUS_ADVOCATE');found=a;}
 if(!page.has_more)return found;if(!page.next_cursor||seen.has(page.next_cursor))throw Error('INVALID_AGENT_CURSOR');after=page.next_cursor;seen.add(after);
 }while(true);
}
