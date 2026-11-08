import {and,desc,eq,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {cases,caseAuthorities,caseDecisions,caseAgentSessions} from "./schema";
import {issueCaseToolCredential} from "./case-tool-auth";
import {registerCaseAgentSession} from "./case-agent-session";
import {naiveClient} from "./providers/naive";
import {caseAgentTools} from "./providers/case-agent";
import {caseAuthority} from "./autonomy-policy";
import {caseBindingMatches} from "./providers/case-binding";

type Client=ReturnType<typeof naiveClient>;
type Page<T>={data:T[];has_more:boolean;next_cursor:string|null};
async function all<T>(read:(after?:string)=>Promise<Page<T>>){
 const items:T[]=[];let cursor:string|undefined;const seen=new Set<string>();
 do{const page=await read(cursor);items.push(...page.data);if(!page.has_more)return items;
  if(!page.next_cursor||seen.has(page.next_cursor))throw Error("INVALID_PROVIDER_PAGINATION");
  cursor=page.next_cursor;seen.add(cursor);
 }while(true);
}
function unique<T>(items:T[]){if(items.length>1)throw Error("AMBIGUOUS_REMOTE_SETUP");return items[0];}
export type ProvisionInput={caseId:string;authorityId:string;owner:string;agentId:string;generalVersion:number;toolsUrl:string};

// Operator-only setup. The transaction makes the sealed token unusable until registration commits.
export async function provisionCaseSession(db:NodePgDatabase,input:ProvisionInput,client:Client=naiveClient()){
 const connector=caseAgentTools(input.toolsUrl,input.caseId);
 if(!Number.isSafeInteger(input.generalVersion)||input.generalVersion<1)throw Error("INVALID_GENERAL_VERSION");
 return db.transaction(async tx=>{
  await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
  // Serialize coordinator version publication across cooperating setup processes.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`assurance-provision:${input.agentId}`}))`);
  const [authority]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,input.authorityId),eq(caseAuthorities.case_id,input.caseId),eq(caseAuthorities.approved_by,input.owner))).for("update");
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,input.caseId),eq(cases.owner_id,input.owner))).for("update");
  if(!authority||!item)throw Error("INVALID_CASE_BINDING");
  if((await tx.execute(sql`SELECT id FROM advocacy_direct_case_runs WHERE authority_id=${authority.id}`)).rows.length)throw Error("DIRECT_ENGINE_ALREADY_REGISTERED");
  if(!(process.env.CREW_ALLOWED_USER_IDS??"").split(",").includes(input.owner))throw Error("OPERATOR_REQUIRED");
  if(!caseAuthority.safeParse(authority.policy).success||!authority.policy.synthetic||!["active","waiting"].includes(authority.state)||new Date(authority.policy.expires_at)<=new Date())throw Error("ACTIVE_SYNTHETIC_AUTHORITY_REQUIRED");
  const [existing]=await tx.select().from(caseAgentSessions).where(eq(caseAgentSessions.authority_id,authority.id));
  if(existing){if(existing.agent_id!==input.agentId)throw Error("SESSION_BINDING_CONFLICT");return existing;}
  const [round]=await tx.select().from(caseDecisions).where(eq(caseDecisions.authority_id,authority.id)).orderBy(desc(caseDecisions.round)).limit(1);
  if(round&&round.state!=="finished"||authority.lease_until&&authority.lease_until>new Date())throw Error("CASE_BUSY");
  const base=await client.agents.getVersion(input.agentId,input.generalVersion);
  if(base.mcp_servers.length||base.tools.default_config.permission!=="deny"||base.budget.period!=="month"||base.budget.cap_micro_usd!==2000000||base.budget.max_task_micro_usd!==250000)throw Error("INVALID_GENERAL_CONFIGURATION");
  const name=`assurance-case-${input.authorityId}`;
  const identities=await all(after=>client.identities.list({limit:100,after}));
  const identity=unique(identities.filter(i=>i.name===name))??await client.identities.create({name,metadata:{case_id:input.caseId,authority_id:input.authorityId}});
  if(identity.metadata.case_id!==input.caseId||identity.metadata.authority_id!==input.authorityId)throw Error("IDENTITY_MISMATCH");
  await client.identities.attach(input.agentId,identity.id);
  const vaults=await all(after=>client.vaults.list({limit:100,after}));
  const vault=unique(vaults.filter(v=>v.identity_id===identity.id))??await client.vaults.create({display_name:name,identity_id:identity.id});
  // A failed prior transaction leaves only invalid remote tokens. Remove them before sealing a fresh one.
  const oldCredentials=await all(after=>client.vaults.credentials.list(vault.id,{limit:100,after}));
  for(const old of oldCredentials){
   if(!old.key.startsWith(`${name}:`)||old.agent_id!==input.agentId||old.mcp_server_url!==connector.mcp_servers[0].url)throw Error("UNEXPECTED_VAULT_CREDENTIAL");
   await client.vaults.credentials.delete(vault.id,old.id);
  }
  const credential=await issueCaseToolCredential(tx,input.caseId,input.owner,authority.id);
  const sealed=await client.vaults.credentials.create(vault.id,{kind:"static_bearer",key:`${name}:${credential.id}`,value:credential.token,mcp_server_url:connector.mcp_servers[0].url,agent_id:input.agentId,expires_at:credential.expires_at?.toISOString()});
  if(sealed.key!==`${name}:${credential.id}`||sealed.kind!=="static_bearer"||sealed.agent_id!==input.agentId||sealed.mcp_server_url!==connector.mcp_servers[0].url||new Date(sealed.expires_at??0).getTime()!==credential.expires_at?.getTime())throw Error("SEALED_CREDENTIAL_MISMATCH");
  const versions=await client.agents.listVersions(input.agentId);
  let version=unique(versions.data.filter(v=>v.metadata.assurance_authority===input.authorityId));
  try{
   if(!version){
    const current=await client.agents.get(input.agentId);
    if(current.mcp_servers.length||current.tools.default_config.permission!=="deny")throw Error("COORDINATOR_DEFAULT_NOT_GENERAL");
    const updated=await client.agents.update(input.agentId,{...connector,system:base.system,metadata:{...base.metadata,assurance_authority:input.authorityId,assurance_restore_version:current.current_version},expected_version:current.current_version});
    version=await client.agents.getVersion(input.agentId,updated.current_version);
   }
  }finally{
   // Read back even after an uncertain publication; never overwrite another case's default.
   const current=await client.agents.get(input.agentId);
   if(current.metadata.assurance_authority===input.authorityId){
    const restoreVersion=current.metadata.assurance_restore_version;
    if(typeof restoreVersion!=="number"||!Number.isSafeInteger(restoreVersion)||restoreVersion<1)throw Error("MISSING_RESTORE_VERSION");
    const prior=await client.agents.getVersion(input.agentId,restoreVersion);
    if(prior.mcp_servers.length||prior.tools.default_config.permission!=="deny")throw Error("INVALID_RESTORE_VERSION");
    await client.agents.rollback(input.agentId,{to_version:restoreVersion,expected_version:current.current_version});
   }else if(current.mcp_servers.length)throw Error("GENERAL_RESTORE_CONFLICT");
  }
  const restored=await client.agents.get(input.agentId);
  if(restored.mcp_servers.length||restored.tools.default_config.permission!=="deny")throw Error("GENERAL_RESTORE_NOT_VERIFIED");
  const attached=await client.identities.agents(identity.id);
  const binding={case_id:input.caseId,identity_id:identity.id,agent_id:input.agentId,agent_version:version.version};
  if(!caseBindingMatches(binding,input.toolsUrl,{version,identity,attachedAgentIds:attached.data.map(a=>a.id)}))throw Error("REMOTE_BINDING_MISMATCH");
  return registerCaseAgentSession(tx,{...binding,authority_id:input.authorityId,credential_id:credential.id},input.owner);
 });
}
