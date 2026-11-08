import {naiveClient} from "./naive";
import {caseAgentTools} from "./case-agent";
export type CaseBinding={case_id:string;identity_id:string;agent_id:string;agent_version:number;open_permission?:boolean;budget_micro_usd?:number};
export type BindingEvidence={version:{version:number;mcp_servers:{name:string;url:string;headers?:Record<string,string>}[];tools:{default_config:{permission:string}};budget:{cap_micro_usd:number;max_task_micro_usd:number;period:string}};identity:{id:string;metadata:Record<string,unknown>};attachedAgentIds:string[]};
export function openNaiveBudget(){
 const amount=Number(process.env.NAIVE_OPEN_SESSION_BUDGET_MICRO_USD);
 if(!Number.isSafeInteger(amount)||amount<=0)throw Error("OPEN_NAIVE_BUDGET_NOT_CONFIGURED");
 return amount;
}
export function caseBindingMatches(binding:CaseBinding,baseUrl:string,evidence:BindingEvidence){
 const expected=caseAgentTools(baseUrl,binding.case_id).mcp_servers[0].url;
 const {version,identity,attachedAgentIds}=evidence;
 let budgetMatches=version.budget.period==="month"&&version.budget.cap_micro_usd===2000000&&version.budget.max_task_micro_usd===250000;
 if(binding.open_permission){
  const amount=binding.budget_micro_usd??openNaiveBudget();
  budgetMatches=Number.isSafeInteger(amount)&&amount>0&&version.budget.period==="month"&&Number.isSafeInteger(version.budget.cap_micro_usd)&&version.budget.cap_micro_usd>=amount&&version.budget.max_task_micro_usd===amount;
 }
 return version.version===binding.agent_version&&version.mcp_servers.length===1&&version.mcp_servers[0].name==="assurance"&&version.mcp_servers[0].url===expected&&!Object.keys(version.mcp_servers[0].headers??{}).length&&version.tools.default_config.permission==="deny"&&budgetMatches&&identity.id===binding.identity_id&&identity.metadata.case_id===binding.case_id&&attachedAgentIds.includes(binding.agent_id);
}
type BindingReader={agents:{getVersion:(id:string,version:number)=>Promise<BindingEvidence["version"]>};identities:{get:(id:string)=>Promise<BindingEvidence["identity"]>;agents:(id:string)=>Promise<{data:{id:string}[]}>}};
export async function verifyCaseBinding(binding:CaseBinding,client:BindingReader=naiveClient()){
 const url=process.env.NAIVE_CASE_TOOLS_URL;if(!url)throw Error("Case tool URL not configured");
 // The shared transport admits one request at a time. Parallel reads would defer each other.
 const version=await client.agents.getVersion(binding.agent_id,binding.agent_version);
 const identity=await client.identities.get(binding.identity_id);
 const attached=await client.identities.agents(binding.identity_id);
 return caseBindingMatches(binding,url,{version,identity,attachedAgentIds:attached.data.map(a=>a.id)});
}
