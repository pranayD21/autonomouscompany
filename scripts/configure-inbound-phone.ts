import {config} from 'dotenv';import fs from 'node:fs';import {smsReady} from '../backend/phone-messaging';
config({path:'.env.local',quiet:true});
const apply=process.argv.includes('--apply');
if(!process.env.AGENTPHONE_AGENT_ID||!process.env.AGENTPHONE_API_KEY||!process.env.PHONE_AUTH_BASE_URL)throw Error('Phone configuration missing');
const base='https://api.agentphone.ai',path=`/v1/agents/${encodeURIComponent(process.env.AGENTPHONE_AGENT_ID)}`,headers={Authorization:`Bearer ${process.env.AGENTPHONE_API_KEY}`,'Content-Type':'application/json'};
async function notificationsReady(){if(process.env.PHONE_NOTIFICATION_PROVIDER!=='mac_messages')return smsReady();const r=await fetch(new URL('/status',process.env.PHONE_AUTH_BASE_URL));return r.ok&&(await r.json()).notificationReady===true;}
const old=await fetch(base+path,{headers});if(!old.ok)throw Error(`Agent read rejected ${old.status}`);const agent=await old.json();
console.log(JSON.stringify({mode:apply?'apply':'plan',currentVoiceMode:agent.voiceMode,targetVoiceMode:'webhook',phoneFlowEnabled:process.env.PHONE_FLOW_ENABLED==='true',smsReady:await notificationsReady(),chargesRegistrationFee:false}));
if(!apply)process.exit(0);
if(!await notificationsReady()||!process.env.AGENTPHONE_WEBHOOK_SECRET)throw Error('SMS activation, phone feature, and webhook secret required before changing inbound routing');
fs.writeFileSync('test-results/agentphone-before-inbound.json',JSON.stringify(agent,null,2),{mode:0o600});
const webhook=await fetch(base+path+'/webhook',{method:'POST',headers,body:JSON.stringify({url:new URL('/agentphone/webhook',process.env.PHONE_AUTH_BASE_URL).href,secret:process.env.AGENTPHONE_WEBHOOK_SECRET,events:['agent.message','agent.call_ended'],timeout:30})});if(!webhook.ok)throw Error(`Webhook setup rejected ${webhook.status}`);
const update=await fetch(base+path,{method:'PATCH',headers,body:JSON.stringify({voiceMode:'webhook',beginMessage:'Hello, this is Assurance’s AI assistant. Assurance can organize your claim, research it, and contact the relevant organizations after you verify your phone. We will not make payments or accept settlements. May we handle your case and text this number a secure upload link and case updates? Say yes to continue.'})});if(!update.ok)throw Error(`Voice mode change rejected ${update.status}`);
const current=await(await fetch(base+path,{headers})).json();if(current.voiceMode!=='webhook')throw Error('Inbound mode readback mismatch');console.log('Inbound webhook routing verified. No call or text placed.');
