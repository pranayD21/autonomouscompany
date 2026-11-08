/** Hosted checks send no email and create no customer, case, mailbox, or lead. */
import {config} from 'dotenv';import {randomUUID,createHmac} from 'node:crypto';import assert from 'node:assert/strict';import {Pool} from 'pg';import {writeFileSync,mkdirSync} from 'node:fs';
config({path:'.env.local',quiet:true});
const webhook=process.env.AGENTMAIL_WEBHOOK_URL!,secret=process.env.AGENTMAIL_WEBHOOK_SECRET!;
assert.ok(webhook&&secret?.startsWith('whsec_'));const firm=new URL(webhook).origin,cases=new URL(process.env.PHONE_AUTH_BASE_URL!).origin.replace('-phone.compute.','-cases.compute.');
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace('sslmode=require','sslmode=verify-full'),max:1});
const eventId=`assurance-unmapped-check-${randomUUID()}`,inbox=`unmapped-fixture-${randomUUID()}`,messageId=randomUUID();
async function get(url:string,options?:RequestInit){const r=await fetch(url,{...options,signal:AbortSignal.timeout(45000),redirect:'error'});return {status:r.status,body:await r.json().catch(()=>null)};}
try{
 assert.equal((await pool.query('SELECT 1 FROM advocacy_case_mailboxes WHERE inbox_id=$1',[inbox])).rowCount,0);assert.notEqual(inbox,process.env.AGENTMAIL_PUBLIC_INBOX_ID||process.env.AGENTMAIL_INBOX_ID);
 const before=Number((await pool.query('SELECT count(*) FROM advocacy_outreach_actions')).rows[0].count);
 const publicContact=await get(`${cases}/firm/contact`);assert.equal(publicContact.status,200);assert.equal(publicContact.body.email,process.env.AGENTMAIL_PUBLIC_EMAIL);
 for(const path of ['/email/leads','/cases'])assert.equal((await get(`${cases}${path}`)).status,401);
 assert.equal((await get(`${firm}/poll`,{method:'POST'})).status,401);
 assert.equal((await get(`${firm}/mcp/ceo`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
 assert.equal((await get(`${firm}/mcp/ceo`,{method:'POST',headers:{Origin:'https://assurance.claims','Content-Type':'application/json'},body:'{}'})).status,403);
 const body=JSON.stringify({event_id:eventId,event_type:'message.received',message:{inbox_id:inbox,message_id:messageId,from:'fictional@example.invalid',to:['unmapped@example.invalid'],text:'Fictional unmapped webhook verification. No case or outreach should be created.'}});
 const timestamp=String(Math.floor(Date.now()/1000)),headers={'Content-Type':'application/json','svix-id':eventId,'svix-timestamp':timestamp,'svix-signature':'v1,invalid'};
 assert.equal((await get(webhook,{method:'POST',headers,body})).status,401);
 headers['svix-signature']=`v1,${createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${eventId}.${timestamp}.${body}`).digest('base64')}`;
 const first=await get(webhook,{method:'POST',headers,body}),repeat=await get(webhook,{method:'POST',headers,body});assert.equal(first.status,200);assert.deepEqual(first.body,{ignored:true});assert.deepEqual(repeat,first);
 const rows=await pool.query('SELECT (SELECT count(*) FROM advocacy_agentmail_events WHERE event_id=$1) AS events,(SELECT count(*) FROM advocacy_email_leads WHERE inbox_id=$2 OR message_id=$3) AS leads,(SELECT count(*) FROM advocacy_outreach_actions) AS outreach',[eventId,inbox,messageId]);assert.equal(Number(rows.rows[0].events),0);assert.equal(Number(rows.rows[0].leads),0);assert.equal(Number(rows.rows[0].outreach),before);
 const provider=await get(`https://api.agentmail.to/v0/webhooks/${encodeURIComponent(process.env.AGENTMAIL_WEBHOOK_ID!)}`,{headers:{Authorization:`Bearer ${process.env.AGENTMAIL_API_KEY}`}});assert.equal(provider.status,200);assert.equal(provider.body.url,webhook);assert.equal(provider.body.enabled,true);assert.ok(['message.received','message.received.spam','message.received.unauthenticated','message.bounced','message.rejected'].every(e=>provider.body.event_types.includes(e)));
 const result={checked_at:new Date().toISOString(),public_contact_matches:true,private_api_requires_auth:true,company_mcp_requires_role_token:true,browser_mcp_rejected:true,unverified_schedule_rejected:true,bad_signature_rejected:true,signed_unmapped_ignored:true,repeat_unmapped_ignored:true,event_rows:0,lead_rows:0,outreach_delta:0,provider_registration_matches:true,provider_generated_delivery_proven:false};
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/hosted-firm-webhook-check.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
}finally{await pool.end();}
