import {config} from 'dotenv';
import {readFileSync,writeFileSync,statSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';

const serviceSchema=z.object({sid:z.string().regex(/^VA[0-9a-fA-F]{32}$/),account_sid:z.string(),friendly_name:z.string(),code_length:z.number()});
const base='https://verify.twilio.com';
// This setup tool only touches Verify service configuration. It has no verification,
// SMS, phone-number purchase, or voice endpoint.
export async function configureVerify({apply=false,envPath='.env.local',request=fetch,env=process.env}:{apply?:boolean;envPath?:string;request?:typeof fetch;env?:NodeJS.ProcessEnv}={}){
 const account=env.TWILIO_ACCOUNT_SID,token=env.TWILIO_AUTH_TOKEN,configured=env.TWILIO_VERIFY_SERVICE_SID;
 if(!account||!/^AC[0-9a-fA-F]{32}$/.test(account)||!token)throw Error('Valid TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required in private configuration.');
 if(configured&&!/^VA[0-9a-fA-F]{32}$/.test(configured))throw Error('TWILIO_VERIFY_SERVICE_SID has an invalid format.');
 const headers={Authorization:`Basic ${Buffer.from(`${account}:${token}`).toString('base64')}`};
 async function api(url:string,body?:URLSearchParams){
  let response:Response;
  try{response=await request(url,{method:body?'POST':'GET',headers:{...headers,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('Twilio request failed or timed out; reconcile the existing service before retrying a creation.');}
  if(!response.ok)throw Error(`Twilio ${body?'create':'read'} returned HTTP ${response.status}; no automatic retry.`);
  try{return await response.json();}catch{throw Error('Twilio returned an unreadable receipt; reconcile before retrying.');}
 }
 const accountData=await api(`https://api.twilio.com/2010-04-01/Accounts/${account}.json`);
 if(accountData.sid!==account||accountData.status!=='active')throw Error('Twilio account identity or active status did not match.');
 const matches:z.infer<typeof serviceSchema>[]=[],seen=new Set<string>();let next:string|null=`${base}/v2/Services?PageSize=100`;
 while(next){
  const url=new URL(next,base);
  if(url.origin!==base||url.pathname!=='/v2/Services'||seen.has(url.href)||seen.size>=100)throw Error('Unexpected or incomplete Verify pagination; no service will be created.');
  seen.add(url.href);
  const page=await api(url.href);
  const parsed=z.object({services:z.array(serviceSchema),meta:z.object({next_page_url:z.string().nullable()})}).safeParse(page);
  if(!parsed.success)throw Error('Unexpected Verify service listing; no service will be created.');
  matches.push(...parsed.data.services.filter(s=>s.friendly_name==='Assurance'));
  next=parsed.data.meta.next_page_url;
 }
 if(matches.length>1)throw Error('Multiple Assurance Verify services exist; reconcile them before applying configuration.');
 let selected=matches[0];
 if(configured&&(!selected||selected.sid!==configured))throw Error('Configured Verify service does not match the sole Assurance service; reconcile before applying.');
 const pendingPath=`${envPath}.verify-creation-pending`;
 let created=false;
 if(!selected){
  if(!apply)return {mode:'plan',accountActive:true,serviceExists:false,action:'create_verify_service',codeLength:6,smsSent:false,numberPurchased:false};
  if(existsSync(pendingPath))throw Error('A previous Verify creation has no reconciled receipt. Inspect the account before retrying; do not remove the pending marker without reconciliation.');
  // Persist the uncertain-creation boundary before the request, without credentials.
  writeFileSync(pendingPath,JSON.stringify({operation:'create_assurance_verify_service',started_at:new Date().toISOString()})+'\n',{flag:'wx',mode:0o600});
  const receipt=serviceSchema.safeParse(await api(`${base}/v2/Services`,new URLSearchParams({FriendlyName:'Assurance',CodeLength:'6'})));
  if(!receipt.success)throw Error('Verify creation returned no valid service receipt; reconcile before retrying.');
  selected=receipt.data;created=true;
 }
 const verified=serviceSchema.safeParse(await api(`${base}/v2/Services/${selected.sid}`));
 if(!verified.success||verified.data.sid!==selected.sid||verified.data.account_sid!==account||verified.data.friendly_name!=='Assurance'||verified.data.code_length!==6)
  throw Error('Existing Verify settings differ from Assurance with a six-digit code; no settings were overwritten.');
 if(apply){
  const original=readFileSync(envPath,'utf8'),mode=statSync(envPath).mode&0o777;
  const pattern=/^(?:export\s+)?TWILIO_VERIFY_SERVICE_SID\s*=.*$/gm;
  const entries=original.match(pattern)??[];if(entries.length>1)throw Error('Duplicate TWILIO_VERIFY_SERVICE_SID entries in private configuration; reconcile before saving.');
  const line=`TWILIO_VERIFY_SERVICE_SID=${verified.data.sid}`;
  const updated=entries.length?original.replace(pattern,()=>line):`${original}${original.endsWith('\n')?'':'\n'}${line}\n`;
  const temporary=`${envPath}.verify-${randomUUID()}`;
  try{
   writeFileSync(temporary,updated,{flag:'wx',mode});
   if(readFileSync(envPath,'utf8')!==original)throw Error('Private configuration changed during setup; rerun to preserve those changes.');
   renameSync(temporary,envPath);
  }finally{if(existsSync(temporary))unlinkSync(temporary);}
  if(existsSync(pendingPath))unlinkSync(pendingPath);
 }
 return {mode:apply?'apply':'plan',accountActive:true,serviceExists:true,created,settingsVerified:true,codeLength:6,privateConfigurationSaved:apply,smsSent:false,numberPurchased:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 config({path:'.env.local',quiet:true});
 const flags=process.argv.slice(2);
 if(flags.some(flag=>flag!=='--apply')){console.error('Usage: npx tsx scripts/configure-twilio-verify.ts [--apply]');process.exitCode=1;}
 else configureVerify({apply:flags.includes('--apply')}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error instanceof Error?error.message:'Verify setup failed.');process.exitCode=1;});
}
