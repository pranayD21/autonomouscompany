import {config} from 'dotenv';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {firmRoles,firmAgentName,firmAgentDeclarations,firmEndpoint,firmWindow,prepareFirmTokenEnvironment} from '../backend/firm-blueprint';
import {naiveFetch} from '../backend/providers/naive-capacity';
import {isNaiveAdmissionRejected} from '../backend/naive-retry';
config({path:'.env.local',quiet:true});
type Row=Record<string,any>;
const digest=(value:unknown)=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const unique=(rows:Row[],label:string)=>{if(rows.length>1)throw Error(`AMBIGUOUS_${label}`);return rows[0];};
async function main(){
 prepareFirmTokenEnvironment();const agents=firmAgentDeclarations();
 const apply=process.argv.includes('--apply');
 if(!apply){console.log(JSON.stringify({mode:'plan',agents:agents.map(a=>({name:a.name,identity:a.identity,endpoint:a.mcp_servers?.[0].url,window:a.window,budget:a.budget,schedules:a.schedules?.map(s=>({cron:s.cron,enabled:s.enabled}))??[]})),legacyAgents:'preserved',mailboxes:'none',next:'Run --apply only after the firm Function is deployed.'},null,2));return;}
 const token=process.env.NAIVE_SETUP_API_KEY??process.env.NAIVE_API_KEY;if(!token)throw Error('NAIVE_SETUP_API_KEY_REQUIRED');
 for(const role of firmRoles)if(!process.env[`ASSURANCE_FIRM_TOKEN_${role.toUpperCase()}`])throw Error('FIRM_ROLE_TOKENS_REQUIRED');
 // Confirm live API shape before any mutations; no source-specific response fields are assumed for writes.
 const specification=await fetch('https://api.vetta.sh/v1/openapi.json').then(async r=>{if(!r.ok)throw Error('OPENAPI_UNAVAILABLE');return r.json();});
 for(const path of ['/v1/agents','/v1/identities','/v1/vaults','/v1/skills','/v1/deployments'])if(!specification.paths?.[path]?.post)throw Error('OPENAPI_CONTRACT_MISMATCH');
 const send=naiveFetch();
 const request=async(path:string,method='GET',body?:unknown):Promise<Row>=>{
  let response:Response;const started=Date.now();
  for(;;){try{response=await send(`https://api.vetta.sh${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});break;}
   catch(error){if(!isNaiveAdmissionRejected(error)||Date.now()-started>45000)throw error;await new Promise(resolve=>setTimeout(resolve,Math.min(5000,Math.max(1000,Number((error as {retryAfterMs?:number}).retryAfterMs??1000)))));}}

  if(!response.ok){const failure=await response.json().catch(()=>({}));const code=typeof failure.code==='string'?failure.code:typeof failure.error?.code==='string'?failure.error.code:'unspecified';console.error(JSON.stringify({method,path,status:response.status,code}));writeFileSync('test-results/firm-setup-error.json',JSON.stringify({method,path,status:response.status,failure}),{mode:0o600});throw Error(`NAIVE_HTTP_${response.status}`);}return response.json();
 };
 const list=async(path:string)=>{const result:Row[]=[];let cursor:string|undefined;const seen=new Set<string>();do{
  const page=await request(`${path}?limit=100${cursor?`&after=${encodeURIComponent(cursor)}`:''}`);if(!Array.isArray(page.data))throw Error('INVALID_PROVIDER_PAGE');result.push(...page.data);
  if(!page.has_more)return result;if(typeof page.next_cursor!=='string'||seen.has(page.next_cursor))throw Error('INVALID_PROVIDER_CURSOR');cursor=page.next_cursor;seen.add(cursor);
 }while(true);};
 const existingAgents=await list('/v1/agents'),identities=await list('/v1/identities'),vaults=await list('/v1/vaults');
 const skills=await list('/v1/skills'),content=readFileSync('docs/firm-operations-skill.md','utf8'),sha256=digest(content);
 const existingSkill=unique(skills.filter(s=>s.slug==='assurance-firm-operations'),'FIRM_SKILL');
 if(!existingSkill||existingSkill.sha256!==sha256)await request('/v1/skills','POST',{slug:'assurance-firm-operations',name:'Assurance firm operations',content,sha256});
 const state:Record<string,Row>={};
 // The CEO's coordinator entries need the permanent role IDs first.
 for(const role of [...firmRoles.filter(r=>r!=='ceo'),'ceo' as const]){
  const declaration=agents.find(a=>a.name===firmAgentName(role))!,name=declaration.name;
  const identity=unique(identities.filter(i=>i.name===name),'FIRM_IDENTITY')??await request('/v1/identities','POST',{name,description:`Assurance permanent ${role} persona`,metadata:{assurance_firm_role:role}});
  const payload:Row={name,harness:declaration.harness,model:declaration.model,window:declaration.window,system:declaration.system,budget:declaration.budget,tools:declaration.tools,mcp_servers:declaration.mcp_servers,skills:declaration.skills,handoffs:false,description:declaration.description};
  if(role==='ceo'){payload.multiagent={type:'coordinator',board:true,agents:firmRoles.filter(r=>r!=='ceo').map(r=>({type:'agent',id:state[r].agent_id,version:state[r].version}))};payload.handoffs=firmRoles.filter(r=>r!=='ceo').map(r=>state[r].agent_id);}
  const configurationHash=digest(payload);payload.metadata={assurance_firm_role:role,assurance_firm_config_hash:configurationHash};
  let agent=unique(existingAgents.filter(a=>a.name===name),'FIRM_AGENT');
  if(agent){agent=await request(`/v1/agents/${agent.id}`);if(agent.metadata?.assurance_firm_role&&agent.metadata.assurance_firm_role!==role)throw Error('FIRM_AGENT_ROLE_CONFLICT');if(agent.metadata?.assurance_firm_config_hash!==configurationHash)agent=await request(`/v1/agents/${agent.id}`,'PATCH',{...payload,expected_version:agent.current_version});}
  else agent=await request('/v1/agents','POST',payload);
  const attachments=await request(`/v1/agents/${agent.id}/identities`);if(!Array.isArray(attachments.data))throw Error('INVALID_IDENTITY_ATTACHMENTS');
  if(!attachments.data.some((i:Row)=>i.id===identity.id))await request(`/v1/agents/${agent.id}/identities`,'POST',{identity:identity.id});
  const identityAgents=await request(`/v1/identities/${identity.id}/agents`);
  if(!Array.isArray(identityAgents.data)||identityAgents.data.some((a:Row)=>a.id!==agent.id))throw Error('FIRM_IDENTITY_SHARED_WITH_ANOTHER_AGENT');
  const vault=unique(vaults.filter(v=>v.display_name===name),'FIRM_VAULT')??await request('/v1/vaults','POST',{display_name:name,identity_id:identity.id});
  if(vault.identity_id!==identity.id)throw Error('FIRM_VAULT_IDENTITY_CONFLICT');
  const credentials=await list(`/v1/vaults/${vault.id}/credentials`),key=`firm-${role}`,endpoint=firmEndpoint(role);
  const sealed=unique(credentials.filter(c=>c.key===key),'FIRM_CREDENTIAL');
  if(sealed){if(sealed.kind!=='static_bearer'||sealed.mcp_server_url!==endpoint||(sealed.agent_id&&sealed.agent_id!==agent.id)||sealed.expires_at)throw Error('FIRM_CREDENTIAL_BINDING_CONFLICT');}
  else await request(`/v1/vaults/${vault.id}/credentials`,'POST',{kind:'static_bearer',key,value:process.env[`ASSURANCE_FIRM_TOKEN_${role.toUpperCase()}`],mcp_server_url:endpoint,agent_id:agent.id});
  state[role]={agent_id:agent.id,version:agent.current_version,identity_id:identity.id,vault_id:vault.id};
  console.log(JSON.stringify({role,configured:true,version:agent.current_version}));
 }
 const deployments=await list('/v1/deployments');
 for(const role of firmRoles){const declaration=agents.find(a=>a.name===firmAgentName(role))!;for(const schedule of declaration.schedules??[]){
  const binding=state[role],existing=unique(deployments.filter(d=>d.agent_id===binding.agent_id&&d.cron===schedule.cron),'FIRM_SCHEDULE');
  const payload={cron:schedule.cron,timezone:schedule.timezone,input_template:schedule.input,budget_micro_usd:schedule.budget_micro_usd,window:firmWindow(),agent_version:binding.version,identity:binding.identity_id,enabled:schedule.enabled};
  const same=existing&&Object.entries(payload).every(([key,value])=>JSON.stringify(existing[key])===JSON.stringify(value));
  if(!same)await request(existing?`/v1/deployments/${existing.id}`:'/v1/deployments',existing?'PATCH':'POST',{...payload,...(existing?{}:{agent_id:binding.agent_id})});
 }}
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/assurance-firm-setup.json',JSON.stringify({configured_at:new Date().toISOString(),roles:state},null,2),{mode:0o600});
 console.log(JSON.stringify({configuredRoles:firmRoles.length,schedules:agents.flatMap(a=>a.schedules??[]).length,legacyAgentsPreserved:true,newMailboxes:0}));
}
main().catch(error=>{console.error(error instanceof Error&&/^[A-Z][A-Z_0-9]+$/.test(error.message)?error.message:'FIRM_SETUP_FAILED_INSPECT_PRIVATE_STATE');process.exitCode=1;});
