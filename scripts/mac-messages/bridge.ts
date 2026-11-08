import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,openSync,closeSync,fsyncSync,chmodSync,lstatSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {config as loadEnv} from 'dotenv';
const execute=promisify(execFile),folder=dirname(fileURLToPath(import.meta.url));
export type Transport='sms'|'imessage';
export type Job={id:string;attempt_id:string;to:string;body:string;transport:Transport};
type Receipt={id:string;attempt_id:string;state:'submitted'|'unknown'|'failed';reason?:string};
type SavedJob={job:Job;fingerprint:string;receipt?:Receipt;acked?:boolean};
export type Journal={version:1;jobs:Record<string,SavedJob>;recipients:Record<string,{after:number}>};
export type Dependencies={request:(path:string,body:unknown)=>Promise<any>;send:(job:Job)=>Promise<void>;watermark:()=>Promise<number>;save:()=>void};
const phone=(v:unknown):v is string=>typeof v==='string'&&/^\+[1-9]\d{7,14}$/.test(v);
const key=(j:Job)=>`${j.id}:${j.attempt_id}`;
const fingerprint=(j:Job)=>createHash('sha256').update(JSON.stringify(j)).digest('hex');
export async function processJob(journal:Journal,job:Job,deps:Dependencies){
 if(!job||!/^[-\w]{1,180}$/.test(job.id)||!/^[-\w]{1,180}$/.test(job.attempt_id)||!phone(job.to)||typeof job.body!=='string'||!job.body.trim()||job.body.length>4000||!['sms','imessage'].includes(job.transport))throw Error('INVALID_BRIDGE_JOB');
 const id=key(job),prior=journal.jobs[id];
 if(prior){if(prior.fingerprint!==fingerprint(job))throw Error('BRIDGE_JOB_CONFLICT');await reportSaved(journal,id,deps);return;}
 // A notification ID must never acquire another local send attempt, even if the server reissues it.
 if(Object.values(journal.jobs).some(p=>p.job.id===job.id)){
  await deps.request('/receipt',{id:job.id,attempt_id:job.attempt_id,state:'unknown',reason:'This notification already has a local send attempt; reconcile before any new attempt.'});return;
 }
 const peer=`${job.transport}:${job.to}`;
 if(!journal.recipients[peer])journal.recipients[peer]={after:await deps.watermark()};
 journal.jobs[id]={job,fingerprint:fingerprint(job)};deps.save();
 try{await deps.send(job);journal.jobs[id].receipt={id:job.id,attempt_id:job.attempt_id,state:'submitted'};}
 catch{journal.jobs[id].receipt={id:job.id,attempt_id:job.attempt_id,state:'unknown',reason:'Messages send did not return a confirmed acceptance. Do not retry automatically.'};}
 deps.save();await reportSaved(journal,id,deps);
}
export async function reportSaved(journal:Journal,id:string,deps:Pick<Dependencies,'request'|'save'>){
 const saved=journal.jobs[id];if(saved.acked)return;
 if(!saved.receipt){saved.receipt={id:saved.job.id,attempt_id:saved.job.attempt_id,state:'unknown',reason:'Local process stopped after reserving a send. Reconcile Messages before retry.'};deps.save();}
 await deps.request('/receipt',saved.receipt);saved.acked=true;deps.save();
}
export function saveJournal(path:string,value:Journal){
 const temp=`${path}.${process.pid}.tmp`;const fd=openSync(temp,'wx',0o600);
 try{writeFileSync(fd,JSON.stringify(value));fsyncSync(fd);}finally{closeSync(fd);}
 renameSync(temp,path);chmodSync(path,0o600);const dir=openSync(dirname(path),'r');try{fsyncSync(dir);}finally{closeSync(dir);}
}
function readJournal(path:string):Journal{
 if(!existsSync(path))return {version:1,jobs:{},recipients:{}};
 const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)!==0)throw Error('PRIVATE_JOURNAL_REQUIRED');
 const j=JSON.parse(readFileSync(path,'utf8'));if(j.version!==1||!j.jobs||!j.recipients)throw Error('INVALID_JOURNAL');return j;
}
async function script(args:string[]){const r=await execute('/usr/bin/osascript',[`${folder}/messages.applescript`,...args],{timeout:15000,maxBuffer:4096});return r.stdout.trim();}
async function replies(args:unknown){
 // stdin data avoids shell and SQL interpolation. Python's sqlite connection is read-only.
 const {spawn}=await import('node:child_process');return new Promise<any>((ok,bad)=>{
  const p=spawn('/usr/bin/python3',[`${folder}/read-replies.py`],{stdio:['pipe','pipe','pipe']});let out='';const timeout=setTimeout(()=>p.kill('SIGTERM'),10000);
  p.stdout.on('data',chunk=>{out+=chunk;if(out.length>1024*1024)p.kill('SIGTERM');});p.stderr.resume();p.on('error',()=>{clearTimeout(timeout);bad(Error('MESSAGES_DATABASE_UNAVAILABLE'));});p.on('close',code=>{clearTimeout(timeout);try{const data=JSON.parse(out);if(code||data.error)throw Error();ok(data);}catch{bad(Error('MESSAGES_DATABASE_UNAVAILABLE'));}});p.stdin.end(JSON.stringify(args));
 });
}
export function apiClient(base:string,token:string,send:typeof fetch=fetch){
 const url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('HTTPS_BRIDGE_URL_REQUIRED');
 return async(path:string,body:unknown)=>{const r=await send(`${base.replace(/\/$/,'')}${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`BRIDGE_HTTP_${r.status}`);return r.json();};
}
async function main(){
 loadEnv({path:'.env.bridge.local',quiet:true});
 const service=process.env.MAC_MESSAGES_SERVICE_ID,transport=process.env.MAC_MESSAGES_TRANSPORT as Transport|undefined;
 if(!process.argv.includes('--run')){
  let automation=false,smsAccounts=0,imessageAccounts=0,selectedReady=false,database=false;
  try{const counts=(await script(['inspect'])).split(',').map(Number);[smsAccounts,imessageAccounts]=counts;automation=true;if(service&&transport)selectedReady=await script(['check',service,transport])==='ready';}catch{}
  try{database=(await replies({mode:'check'})).ready===true;}catch{}
  console.log(JSON.stringify({platform:process.platform,automation,smsAccounts,imessageAccounts,selectedReady,database,configured:!!service&&!!transport&&!!process.env.MAC_MESSAGES_BRIDGE_URL&&!!process.env.MAC_MESSAGES_BRIDGE_TOKEN,sendsPerformed:0}));return;
 }
 if(process.platform!=='darwin'||!service||!['sms','imessage'].includes(transport??'')||!process.env.MAC_MESSAGES_SENDER_LABEL||process.env.MAC_MESSAGES_SENDER_CONFIRMED!=='true'||!process.env.MAC_MESSAGES_BRIDGE_URL||!process.env.MAC_MESSAGES_BRIDGE_TOKEN)throw Error('EXPLICIT_MAC_SENDER_CONFIGURATION_REQUIRED');
 const path=resolve(process.env.MAC_MESSAGES_JOURNAL??'test-results/mac-messages/journal.json');mkdirSync(dirname(path),{recursive:true,mode:0o700});
 const lock=`${path}.lock`;const fd=openSync(lock,'wx',0o600);writeFileSync(fd,String(process.pid));closeSync(fd);
 const journal=readJournal(path);const save=()=>saveJournal(path,journal);const request=apiClient(process.env.MAC_MESSAGES_BRIDGE_URL,process.env.MAC_MESSAGES_BRIDGE_TOKEN);
 let stopped=false;process.once('SIGINT',()=>{stopped=true;});process.once('SIGTERM',()=>{stopped=true;});
 try{
  save();const deps:Dependencies={request,save,watermark:async()=>Number((await replies({mode:'watermark'})).rowid),send:async job=>{if(job.transport!==transport)throw Error('TRANSPORT_MISMATCH');if(await script(['send',service,transport!,job.to,job.body])!=='submitted')throw Error('SEND_NOT_CONFIRMED');}};
  // Report surviving reservations before claiming anything, never invoke Messages again for them.
  for(const id of Object.keys(journal.jobs))await reportSaved(journal,id,deps);
  while(!stopped){
   const ready=await script(['check',service,transport!]).then(s=>s==='ready').catch(()=>false)&&await replies({mode:'check'}).then(x=>x.ready===true).catch(()=>false);
   await request('/heartbeat',{ready,transport,sender_label:process.env.MAC_MESSAGES_SENDER_LABEL});
   if(ready){
    for(const[peer,cursor]of Object.entries(journal.recipients)){
     const split=peer.indexOf(':'),mode=peer.slice(0,split),from=peer.slice(split+1);
     const batch=await replies({mode:'replies',phone:from,transport:mode,after:cursor.after});
     for(const message of batch.messages){
      if(message.unsupported)throw Error('REPLY_REQUIRES_MANUAL_REVIEW');
      await request('/inbound',{event_id:createHash('sha256').update(`${mode}:${message.guid}`).digest('hex'),from,text:message.text,received_at:new Date(message.unix_ms).toISOString(),thread:message.thread});cursor.after=message.rowid;save();
     }
    }
    const claimed=await request('/claim',{});if(claimed.job)await processJob(journal,claimed.job,deps);
   }
   if(process.argv.includes('--once'))break;
   await new Promise(r=>setTimeout(r,5000));
  }
 }finally{await request('/heartbeat',{ready:false,transport,sender_label:process.env.MAC_MESSAGES_SENDER_LABEL}).catch(()=>{});unlinkSync(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{const safe=e instanceof Error&&/^[A-Z][A-Z_0-9]+$/.test(e.message)?e.message:'MAC_BRIDGE_STOPPED_RECONCILIATION_REQUIRED';console.error(safe);process.exitCode=1;});
