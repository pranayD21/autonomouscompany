import {isNaiveCapacityError,naiveRetryAt} from "./naive-retry";
import {and,eq,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {cases,caseAuthorities,caseAgentSetups} from "./schema";
import {provisionCaseSession,type ProvisionInput} from "./provision-case-session";
import {naiveClient} from "./providers/naive";
export type SetupDependencies={provision:(input:ProvisionInput)=>Promise<unknown>};
export async function pollCaseAgentSetups(db:NodePgDatabase,deps?:SetupDependencies){
 const stats={checked:0,failed:0,deferred:0,configured:!!deps||process.env.NAIVE_CASE_PROVISIONING_ENABLED==="true"&&!!process.env.NAIVE_SETUP_API_KEY};
 if(!stats.configured)return stats;
 const result=await db.execute(sql`WITH due AS (
  SELECT id FROM advocacy_case_agent_setups WHERE state='queued' AND next_check_at<=now()
  AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
  UPDATE advocacy_case_agent_setups s SET lease_id=gen_random_uuid(),lease_until=now()+interval '20 minutes',attempts=attempts+1
  FROM due WHERE s.id=due.id RETURNING s.id,s.lease_id`);
 const claim=result.rows[0] as {id:string;lease_id:string}|undefined;if(!claim)return stats;
 const [job]=await db.select().from(caseAgentSetups).where(eq(caseAgentSetups.id,claim.id));
 const bound=and(eq(caseAgentSetups.id,job.id),eq(caseAgentSetups.lease_id,claim.lease_id));
 try{
  const [item]=await db.select().from(cases).where(eq(cases.id,job.case_id));
  const [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,job.authority_id));
  if(!item||!authority||authority.case_id!==item.id||item.owner_id!==job.requested_by||authority.approved_by!==job.requested_by||!authority.policy.synthetic||!["active","waiting"].includes(authority.state)||new Date(authority.policy.expires_at)<=new Date()||!(process.env.CREW_ALLOWED_USER_IDS??"").split(",").includes(job.requested_by)){
   await db.update(caseAgentSetups).set({state:"stopped",reason:"Case authorization or operator access is no longer active."}).where(bound);
  }else{
   const input={caseId:job.case_id,authorityId:job.authority_id,owner:job.requested_by,agentId:process.env.NAIVE_COORDINATOR_ID!,generalVersion:Number(process.env.NAIVE_GENERAL_AGENT_VERSION),toolsUrl:process.env.NAIVE_CASE_TOOLS_URL!};
   if(deps)await deps.provision(input);
   else await provisionCaseSession(db,input,naiveClient(process.env.NAIVE_SETUP_API_KEY));
   await db.update(caseAgentSetups).set({state:"ready",reason:null}).where(bound);
  }
  stats.checked++;
 }catch(error){
  if(isNaiveCapacityError(error))stats.deferred++;else stats.failed++;
  await db.update(caseAgentSetups).set({next_check_at:await naiveRetryAt(db,error,Math.min(900000,60000*2**Math.min(job.attempts,4))),reason:"Case setup is waiting for provider access. The same authorization will be retried; no replacement grant was created."}).where(bound);
 }finally{await db.update(caseAgentSetups).set({lease_id:null,lease_until:null}).where(bound);}
 return stats;
}
