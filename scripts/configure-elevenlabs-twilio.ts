import {config} from "dotenv";
import {readFileSync,writeFileSync} from "node:fs";
import {elevenLabsOutreachPrompt} from "../backend/providers/voice-config";
config({path:[".env.local",".env"],quiet:true});
// Explicit invocation imports the selected number and configures voice routing; never places a call.
const agentOnly=process.argv.includes("--agent-only");
for(const key of agentOnly?["ELEVENLABS_API_KEY"]:["ELEVENLABS_API_KEY","ELEVENLABS_AGENT_ID","TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","TWILIO_PHONE_NUMBER"])
 if(!process.env[key])throw new Error(`${key} is required. Use private credential entry; never paste secrets into chat.`);
if(!agentOnly&&!/^\+[1-9]\d{7,14}$/.test(process.env.TWILIO_PHONE_NUMBER!))throw new Error("TWILIO_PHONE_NUMBER must be E.164");
const base="https://api.elevenlabs.io/v1/convai";
const headers={"xi-api-key":process.env.ELEVENLABS_API_KEY!,"Content-Type":"application/json"};
async function api(path:string,method="GET",body?:unknown) {
 const r=await fetch(`${base}${path}`,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(`ElevenLabs ${method} ${path} HTTP ${r.status}; no automatic retry`);
 return r.json();
}
function saveEnv(key:string,value:string) {
 const p=".env.local";let s=readFileSync(p,"utf8");const line=`${key}=${value}`;
 s=new RegExp(`^${key}=.*$`,"m").test(s)?s.replace(new RegExp(`^${key}=.*$`,"m"),()=>line):s+`\n${line}\n`;
 writeFileSync(p,s,{mode:0o600});process.env[key]=value;
}
let agentId=process.env.ELEVENLABS_OUTREACH_AGENT_ID;
if(!agentId){
 const list=await api("/agents");if(list.has_more)throw new Error("Agent listing is paginated; select existing ELEVENLABS_OUTREACH_AGENT_ID explicitly");
 const found=list.agents.filter((a:{name:string})=>a.name==="Assurance Case Outreach");
 if(found.length>1)throw new Error("Multiple outreach agents; select the existing ID explicitly");
 agentId=found[0]?.agent_id;
 if(!agentId){const created=await api("/agents/create","POST",{
  name:"Assurance Case Outreach",tags:["synthetic-demo"],
  conversation_config:{agent:{first_message:"Hi, I'm Assurance's AI assistant calling for an authorized synthetic demo. Please don't share real medical information. Is now a good time?",language:"en",prompt:{prompt:elevenLabsOutreachPrompt,llm:"gpt-4o-mini",max_tokens:300}},conversation:{max_duration_seconds:180},turn:{silence_end_call_timeout:30}},
  platform_settings:{auth:{enable_auth:true},privacy:{record_voice:false,retention_days:7},call_limits:{agent_concurrency_limit:1,daily_limit:10,bursting_enabled:false}},
 });agentId=created.agent_id;}
 if(!agentId)throw new Error("Agent creation had no receipt; reconcile in dashboard before retrying");
 saveEnv("ELEVENLABS_OUTREACH_AGENT_ID",agentId);
}
const agent=await api(`/agents/${encodeURIComponent(agentId)}`);
if(agent.conversation_config?.agent?.prompt?.prompt!==elevenLabsOutreachPrompt||agent.platform_settings?.privacy?.record_voice!==false||agent.platform_settings?.auth?.enable_auth!==true||agent.conversation_config?.conversation?.max_duration_seconds!==180)
 throw new Error("Outreach agent settings mismatch; inspect existing agent before proceeding");
if(agentOnly){
 console.log(JSON.stringify({agentConfigured:true,outreachAgentId:agentId,phoneConfigured:false,callPlaced:false}));
 process.exit(0);
}
const numbers=await api("/phone-numbers?provider=twilio");
if(!Array.isArray(numbers))throw new Error("Unexpected phone list; reconcile before retrying");
const matches=numbers.filter(n=>n.phone_number===process.env.TWILIO_PHONE_NUMBER);
if(matches.length>1)throw new Error("Duplicate numbers; reconcile before proceeding");
let numberId=matches[0]?.phone_number_id;
if(!numberId){const imported=await api("/phone-numbers","POST",{provider:"twilio",label:"Assurance",phone_number:process.env.TWILIO_PHONE_NUMBER,sid:process.env.TWILIO_ACCOUNT_SID,token:process.env.TWILIO_AUTH_TOKEN,enable_sms:false,agent_id:process.env.ELEVENLABS_AGENT_ID});numberId=imported.phone_number_id;}
if(!numberId)throw new Error("No number receipt; reconcile before retrying");
saveEnv("ELEVENLABS_PHONE_NUMBER_ID",numberId);
const number=await api(`/phone-numbers/${encodeURIComponent(numberId)}`);
if(number.provider!=="twilio"||number.phone_number!==process.env.TWILIO_PHONE_NUMBER||number.supports_outbound===false)throw new Error("Imported number is not ready for outbound calls");
console.log(JSON.stringify({configured:true,provider:"elevenlabs_twilio",outreachAgentId:agentId,phoneNumberId:numberId,callPlaced:false}));
