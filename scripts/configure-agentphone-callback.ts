import {config} from 'dotenv';
import {CALLBACK_GREETING,CALLBACK_PROMPT} from '../backend/phone-onboarding';

config({path:'.env.local',quiet:true});
const response=await fetch(`https://api.agentphone.ai/v1/agents/${encodeURIComponent(process.env.AGENTPHONE_AGENT_ID!)}`,{method:'PATCH',headers:{Authorization:`Bearer ${process.env.AGENTPHONE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({name:'Assurance',description:'Workplace-injury and insurance-claim intake and follow-up calls.',systemPrompt:CALLBACK_PROMPT,beginMessage:CALLBACK_GREETING}),signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error(`AGENTPHONE_HTTP_${response.status}`);
const agent=await response.json();
if(agent.systemPrompt!==CALLBACK_PROMPT||agent.beginMessage!==CALLBACK_GREETING)throw Error('AGENT_READBACK_MISMATCH');
console.log('PASS hosted agent callback script updated and read back');
