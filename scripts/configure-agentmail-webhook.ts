import {config} from 'dotenv';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {AGENTMAIL_EVENT_TYPES} from '../backend/agentmail-webhook';
config({path:'.env.local',quiet:true});
const apply=process.argv.includes('--apply');
const url=process.env.AGENTMAIL_WEBHOOK_URL;
if(!url||new URL(url).protocol!=='https:')throw Error('Set AGENTMAIL_WEBHOOK_URL to the deployed HTTPS webhook endpoint.');
const key=process.env.AGENTMAIL_API_KEY;if(!key)throw Error('AGENTMAIL_API_KEY is required.');
async function api(path:string,method='GET',body?:unknown){const response=await fetch(`https://api.agentmail.to/v0/${path}`,{method,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`AgentMail HTTP ${response.status}`);return response.json();}
const webhooks:any[]=[];let token:string|undefined;
do{const page=await api(`webhooks${token?`?page_token=${encodeURIComponent(token)}`:''}`);webhooks.push(...page.webhooks);token=page.next_page_token;}while(token);
const existing=webhooks.find(w=>w.client_id==='assurance-email-ingress'||w.url===url);
console.log(JSON.stringify({apply,operation:existing?'update':'create',url,event_types:AGENTMAIL_EVENT_TYPES,scope:'all inboxes; application accepts only registered case/public inboxes',sendsPerformed:0}));
if(apply){
 const webhook=await api(existing?`webhooks/${encodeURIComponent(existing.webhook_id)}`:'webhooks',existing?'PATCH':'POST',{url,event_types:AGENTMAIL_EVENT_TYPES,...(existing?{enabled:true}:{client_id:'assurance-email-ingress'})});
 const complete=webhook.secret?webhook:await api(`webhooks/${encodeURIComponent(existing?.webhook_id??webhook.webhook_id)}`);
 if(typeof complete.secret!=='string'||!complete.secret.startsWith('whsec_'))throw Error('Webhook signing secret unavailable');
 let env=await readFile('.env.local','utf8');
 for(const [name,value] of Object.entries({AGENTMAIL_WEBHOOK_SECRET:complete.secret,AGENTMAIL_WEBHOOK_ID:complete.webhook_id})){
  const line=`${name}=${JSON.stringify(value)}`;const re=new RegExp(`^${name}=.*$`,'m');env=re.test(env)?env.replace(re,line):`${env.trimEnd()}\n${line}\n`;
 }
 await writeFile('.env.local',env,{mode:0o600});await chmod('.env.local',0o600);
 console.log('Webhook configured; signing secret saved privately. Deploy it to the receiving Function before enabling traffic. No email sent.');
}
