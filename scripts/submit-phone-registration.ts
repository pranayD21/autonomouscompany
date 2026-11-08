import {config} from 'dotenv';import fs from 'node:fs';import {createHash} from 'node:crypto';
config({path:'.env.local',quiet:true});
const index=process.argv.indexOf('--file');if(index<0||!process.argv[index+1])throw Error('Use --file PRIVATE_REGISTRATION_JSON; add --submit only after explicit $25 approval.');
const body=JSON.parse(fs.readFileSync(process.argv[index+1],'utf8'));const submit=process.argv.includes('--submit');
if(body.registration_type!=='sole_proprietor'||body.create_sub_account!==false||body.planned_numbers!==1)throw Error('Only the reviewed individual registration on the existing account is supported.');
const required=['first_name','last_name','email','phone_number','street_address','city','state','zip_code','description','consent_flow','opt_in_image_url'];for(const k of required)if(typeof body[k]!=='string'||!body[k].trim())throw Error(`Missing registration field ${k}`);
if(!/^\+[1-9]\d{7,14}$/.test(body.phone_number)||!Array.isArray(body.message_samples)||body.message_samples.length<2)throw Error('Invalid registration contact or samples');
const image=await fetch(body.opt_in_image_url,{signal:AbortSignal.timeout(10000)});if(!image.ok||!image.headers.get('content-type')?.startsWith('image/'))throw Error('Opt-in screenshot is not public');
const headers={Authorization:`Bearer ${process.env.AGENTPHONE_API_KEY}`,'Content-Type':'application/json'},base='https://api.agentphone.ai';
const status=await fetch(base+'/v1/register/status',{headers,signal:AbortSignal.timeout(10000)});if(!status.ok)throw Error(`Registration status rejected ${status.status}`);const prior=await status.json();
console.log(JSON.stringify({mode:submit?'submit':'plan',registrationType:'sole_proprietor',feeUsd:25,existingAccount:true,priorCampaignStatus:prior.campaign_status,personalFieldsSuppressed:true}));
if(!submit)process.exit(0);
if(prior.campaign_status!=='none')throw Error('An existing registration must be reconciled rather than submitted again');
const journal='test-results/agentphone-registration-attempt.json';if(fs.existsSync(journal))throw Error('Prior registration attempt exists; reconcile it before any new paid submission');
const record={attempted_at:new Date().toISOString(),request_sha256:createHash('sha256').update(JSON.stringify(body)).digest('hex'),state:'dispatching'};
fs.writeFileSync(journal,JSON.stringify(record,null,2),{mode:0o600});
try{
 const response=await fetch(base+'/v1/register',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const result=await response.json();fs.writeFileSync('test-results/agentphone-registration-response.json',JSON.stringify(result,null,2),{mode:0o600});
 fs.writeFileSync(journal,JSON.stringify({...record,state:response.ok?'submitted':response.status<500?'rejected':'unknown',http:response.status,request_id:response.headers.get('x-request-id')},null,2),{mode:0o600});
 console.log(JSON.stringify({http:response.status,accepted:response.ok,campaign_status:result.campaign_status,stage:result.stage,request_id:response.headers.get('x-request-id')}));if(!response.ok)process.exitCode=1;
}catch{fs.writeFileSync(journal,JSON.stringify({...record,state:'unknown'},null,2),{mode:0o600});throw Error('Registration outcome uncertain. Inspect the existing registration; do not resubmit automatically.');}
