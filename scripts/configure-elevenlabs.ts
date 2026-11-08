import { config } from "dotenv";
import { appendFileSync } from "node:fs";
import { agentPhoneConfig, voicePrompt } from "../backend/providers/voice-config";
config({path:[".env.local",".env"],quiet:true});
if(!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY required");
const headers={"xi-api-key":process.env.ELEVENLABS_API_KEY,"Content-Type":"application/json"};
let id=process.env.ELEVENLABS_AGENT_ID;
if(!id) {
 const r=await fetch("https://api.elevenlabs.io/v1/convai/agents",{headers});
 if(!r.ok) throw new Error(`List HTTP ${r.status}`);
 const data=await r.json();
 const matches=data.agents.filter((a:{name:string})=>["Assurance Demo","Bill Advocate Demo"].includes(a.name));
 if(matches.length>1) throw new Error("Multiple matching agents; select ID explicitly");
 id=matches[0]?.agent_id;
}
if(!id) {
 const r=await fetch("https://api.elevenlabs.io/v1/convai/agents/create",{method:"POST",headers,body:JSON.stringify({
  name:"Assurance Demo",tags:["synthetic-demo"],
  conversation_config:{agent:{first_message:agentPhoneConfig.beginMessage,language:"en",prompt:{prompt:voicePrompt,llm:"gpt-4o-mini",max_tokens:300}},conversation:{max_duration_seconds:180},turn:{silence_end_call_timeout:30}},
  platform_settings:{auth:{enable_auth:true},privacy:{record_voice:false,retention_days:7},call_limits:{agent_concurrency_limit:1,daily_limit:10,bursting_enabled:false}},
 })});
 if(!r.ok) {console.error(`Create HTTP ${r.status}`,await r.text());process.exit(1);}
 id=(await r.json()).agent_id;
}
if(!process.env.ELEVENLABS_AGENT_ID) appendFileSync('.env.local',`\nELEVENLABS_AGENT_ID=${id}\n`);
const r=await fetch(`https://api.elevenlabs.io/v1/convai/agents/${id}`,{headers});
if(!r.ok) throw new Error(`Readback HTTP ${r.status}`);
let a=await r.json();
const updated=await fetch(`https://api.elevenlabs.io/v1/convai/agents/${id}`,{method:"PATCH",headers,body:JSON.stringify({name:"Assurance Demo",conversation_config:{...a.conversation_config,agent:{...a.conversation_config.agent,first_message:agentPhoneConfig.beginMessage,prompt:{...a.conversation_config.agent.prompt,prompt:voicePrompt}}}})});
if(!updated.ok)throw new Error(`Update HTTP ${updated.status}`);
const verified=await fetch(`https://api.elevenlabs.io/v1/convai/agents/${id}`,{headers});
if(!verified.ok)throw new Error(`Verify HTTP ${verified.status}`);
a=await verified.json();
if(a.conversation_config?.agent?.prompt?.prompt!==voicePrompt||a.conversation_config?.agent?.first_message!==agentPhoneConfig.beginMessage)throw new Error("ElevenLabs saved prompt or greeting does not match the requested demo");
if(a.platform_settings?.auth?.enable_auth!==true||a.platform_settings?.privacy?.record_voice!==false||a.conversation_config?.conversation?.max_duration_seconds!==180)throw new Error("ElevenLabs demo authentication, recording, or duration settings changed");
console.log(JSON.stringify({id,name:a.name,prompt_matches:true,greeting_matches:true,auth_required:a.platform_settings?.auth?.enable_auth,record_voice:a.platform_settings?.privacy?.record_voice,max_duration_seconds:a.conversation_config?.conversation?.max_duration_seconds}));
