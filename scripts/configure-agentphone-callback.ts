import {config} from 'dotenv';
import {CALLBACK_GREETING,CALLBACK_PROMPT} from '../backend/phone-onboarding';

config({path:'.env.local',quiet:true});
const base=process.env.VITE_CASES_API_URL||`https://${process.env.NEON_BRANCH_ID}-cases${process.env.NEON_FUNCTION_HOST_SUFFIX}`;
if(!process.env.AGENTPHONE_TOOL_SECRET)throw Error('AGENTPHONE_TOOL_SECRET_REQUIRED');
const tool=(name:string,description:string,parameters?:object)=>({name,description,url:`${base}/voice-tools/${name}`,method:'POST',headers:{'x-assurance-tool-secret':process.env.AGENTPHONE_TOOL_SECRET},timeoutMs:10000,...(parameters?{parameters}:{})});
const caseNumber={case_number:{type:'integer',description:'The case_number from get_open_cases.'}};
const customTools=[
 tool('get_open_cases','Look up the open cases for the account verified with this caller\'s phone number. Call this when the caller first speaks.'),
 tool('get_case_details','Read where one of the caller\'s open cases stands. Use when they are calling about an existing case.',{type:'object',properties:caseNumber,required:['case_number']}),
 tool('save_case_update','Save new information from the caller to one of their open cases, so their advocate sees it.',{type:'object',properties:{...caseNumber,update:{type:'string',description:'What the caller said is new, in their words.'}},required:['case_number','update']}),
];
const response=await fetch(`https://api.agentphone.ai/v1/agents/${encodeURIComponent(process.env.AGENTPHONE_AGENT_ID!)}`,{method:'PATCH',headers:{Authorization:`Bearer ${process.env.AGENTPHONE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({name:'Assurance',description:'Workplace-injury and insurance-claim intake and follow-up calls.',customTools,systemPrompt:CALLBACK_PROMPT,beginMessage:CALLBACK_GREETING}),signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error(`AGENTPHONE_HTTP_${response.status}`);
const agent=await response.json();
if(agent.systemPrompt!==CALLBACK_PROMPT||agent.beginMessage!==CALLBACK_GREETING||agent.customTools?.length!==customTools.length)throw Error('AGENT_READBACK_MISMATCH');
console.log('PASS hosted agent callback script updated and read back');
