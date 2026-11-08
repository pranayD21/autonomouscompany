import {directBlocksNaive} from './migrate-direct-case';
import {isOpenCasePermission} from "./open-case-policy";
import {isNaiveCapacityError,naiveRetryAt} from "./naive-retry";
import {and,eq,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {cases,caseAuthorities,caseAgentSetups,firmStaffing,firmRecords} from "./schema";
import {provisionCaseSession,type ProvisionInput} from "./provision-case-session";
import {naiveClient} from "./providers/naive";
export type SetupDependencies={provision:(input:ProvisionInput)=>Promise<unknown>};
export async function pollCaseAgentSetups(db:NodePgDatabase,deps?:SetupDependencies){
 const stats={checked:0,failed:0,deferred:0,configured:!!deps||process.env.NAIVE_CASE_PROVISIONING_ENABLED==="true"&&!!process.env.NAIVE_SETUP_API_KEY};
 if(!stats.configured)return stats;
 const result=await db.execute(sql`WITH due AS (
  SELECT id FROM advocacy_case_agent_setups WHERE state='queued' AND next_check_at<=now()
  AND NOT EXISTS (SELECT 1 FROM advocacy_direct_case_runs r WHERE r.authority_id=advocacy_case_agent_setups.authority_id AND ${directBlocksNaive})
  AND (NOT EXISTS (SELECT 1 FROM advocacy_firm_staffing f WHERE f.authority_id=advocacy_case_agent_setups.authority_id)
   OR EXISTS (SELECT 1 FROM advocacy_firm_staffing f JOIN advocacy_firm_records r ON r.key='advocate-provision:'||f.authority_id::text AND r.kind='advocate_provisioning' WHERE f.authority_id=advocacy_case_agent_setups.authority_id AND f.state='hiring' AND f.agent_id IS NOT NULL))
  AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
  UPDATE advocacy_case_agent_setups s SET lease_id=gen_random_uuid(),lease_until=now()+interval '20 minutes',attempts=attempts+1
  FROM due WHERE s.id=due.id RETURNING s.id,s.lease_id`);
 const claim=result.rows[0] as {id:string;lease_id:string}|undefined;if(!claim)return stats;
 const [job]=await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.id,claim.id));
 const bound=and(eq(caseAgentSetups.id,job.id),eq(caseAgentSetups.lease_id,claim.lease_id));
 try{
  const [item]=await db.select().from(cases).where(eq(cases.id,job.case_id));
  const [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,job.authority_id));
  if(!item||!authority||authority.case_id!==item.id||item.owner_id!==job.requested_by||authority.approved_by!==job.requested_by||!["active","waiting","human_required"].includes(authority.state)||(!isOpenCasePermission(authority.policy)&&(!authority.policy.synthetic||authority.state==="human_required"||new Date(authority.policy.expires_at)<=new Date()||!(process.env.CREW_ALLOWED_USER_IDS??"").split(",").includes(job.requested_by)))){
   await db.update(caseAgentSetups).set({state:"stopped",reason:"Case authorization or operator access is no longer active."}).where(bound);
  }else if(authority.state==="human_required"){
   await db.update(caseAgentSetups).set({next_check_at:new Date(Date.now()+300000),reason:authority.reason??"Waiting for the owner."}).where(bound);
  }else{
   const input:ProvisionInput={caseId:job.case_id,authorityId:job.authority_id,owner:job.requested_by,agentId:isOpenCasePermission(authority.policy)?process.env.NAIVE_OPEN_COORDINATOR_ID??process.env.NAIVE_COORDINATOR_ID!:process.env.NAIVE_COORDINATOR_ID!,generalVersion:Number(isOpenCasePermission(authority.policy)?process.env.NAIVE_OPEN_GENERAL_AGENT_VERSION??process.env.NAIVE_GENERAL_AGENT_VERSION:process.env.NAIVE_GENERAL_AGENT_VERSION),toolsUrl:process.env.NAIVE_CASE_TOOLS_URL!};
   const [staff]=await db.select().from(firmStaffing).where(eq(firmStaffing.authority_id,authority.id));
   let firmJob:typeof firmRecords.$inferSelect|undefined;
   if(staff){
    [firmJob]=await db.select().from(firmRecords).where(eq(firmRecords.key,`advocate-provision:${authority.id}`));
    const version=firmJob?.payload.general_version;
    if(!isOpenCasePermission(authority.policy)||staff.case_id!==item.id||staff.state!=='hiring'||!staff.agent_id||!staff.budget_micro_usd||!firmJob||firmJob.kind!=='advocate_provisioning'||firmJob.case_id!==item.id||firmJob.payload.authority_id!==authority.id||firmJob.payload.agent_id!==staff.agent_id||typeof version!=='number'||!Number.isSafeInteger(version)||version<1)throw Error('INVALID_FIRM_PROVISION_BINDING');
    input.agentId=staff.agent_id;input.generalVersion=version;input.budgetMicroUsd=staff.budget_micro_usd;
   }
   if(deps)await deps.provision(input);
   else await provisionCaseSession(db,input,naiveClient(process.env.NAIVE_SETUP_API_KEY));
   await db.transaction(async tx=>{
    await tx.update(caseAgentSetups).set({state:"ready",reason:null}).where(bound);
    if(staff&&firmJob){
     await tx.update(firmStaffing).set({state:'active',updated_at:new Date()}).where(and(eq(firmStaffing.case_id,item.id),eq(firmStaffing.authority_id,authority.id),eq(firmStaffing.agent_id,staff.agent_id!)));
     await tx.update(firmRecords).set({payload:{...firmJob.payload,state:'ready'},updated_at:new Date()}).where(eq(firmRecords.key,firmJob.key));
    }
   });
  }
  stats.checked++;
 }catch(error){
  if(isNaiveCapacityError(error))stats.deferred++;else stats.failed++;
  await db.update(caseAgentSetups).set({next_check_at:await naiveRetryAt(db,error,Math.min(900000,60000*2**Math.min(job.attempts,4))),reason:"Case setup is waiting for provider access. The same authorization will be retried; no replacement grant was created."}).where(bound);
 }finally{await db.update(caseAgentSetups).set({lease_id:null,lease_until:null}).where(bound);}
 return stats;
}
