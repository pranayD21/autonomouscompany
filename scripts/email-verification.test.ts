import {claimEmailLead} from '../backend/agentmail-webhook';
import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';import {drizzle} from 'drizzle-orm/node-postgres';import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {requestEmailVerification,confirmEmailVerification} from '../backend/email-verification';import {verifiedOwnerEmail} from '../backend/verified-email';
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error('Disposable DB required');const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace('sslmode=require','sslmode=verify-full')}),db=drizzle(pool),owner=randomUUID(),email=`fixture-${owner}@example.com`;let token='',sends=0;const mailboxCaseIds:string[]=[];
process.env.AGENTMAIL_API_KEY='fixture';process.env.AGENTMAIL_PUBLIC_INBOX_ID='public-fixture';
before(async()=>{await migrate(db,{migrationsFolder:'drizzle'});
 // Neon provides this table in production; plain Postgres needs a stand-in.
 await pool.query('CREATE SCHEMA IF NOT EXISTS neon_auth');await pool.query('CREATE TABLE IF NOT EXISTS neon_auth."user"(id text PRIMARY KEY,name text,email text,"emailVerified" boolean,"createdAt" timestamptz,"updatedAt" timestamptz)');
 await pool.query('INSERT INTO neon_auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,false,now(),now())',[owner,'Verification fixture',email]);});
after(async()=>{for(const id of mailboxCaseIds)await pool.query('DELETE FROM advocacy_cases WHERE id=$1',[id]);await pool.query('DELETE FROM advocacy_email_leads WHERE claimed_owner=$1 OR sender=$2',[owner,email]);await pool.query('DELETE FROM advocacy_case_authorities WHERE approved_by=$1',[owner]);await pool.query('DELETE FROM advocacy_cases WHERE owner_id=$1',[owner]);await pool.query('DELETE FROM advocacy_firm_records WHERE actor=$1',[owner]);await pool.query('DELETE FROM neon_auth."user" WHERE id=$1',[owner]);await pool.end();});
test('verification sends once via AgentMail, stores no raw token and verifies same current owner email',async()=>{
 const fake=(async(url:unknown,init?:RequestInit)=>{sends++;assert.match(String(url),/public-fixture\/messages\/send$/);const body=JSON.parse(String(init?.body));assert.deepEqual(body.to,[email]);token=new URL(body.text.match(/https:\/\/\S+/)[0]).searchParams.get('verify_email')!;return Response.json({message_id:'verification-message'});}) as typeof fetch;
 assert.equal(await verifiedOwnerEmail(pool,owner),null);await requestEmailVerification(db,pool,owner,'https://assurance.example',fake);await requestEmailVerification(db,pool,owner,'https://assurance.example',fake);assert.equal(sends,1);
 const rows=await pool.query('SELECT payload FROM advocacy_firm_records WHERE actor=$1',[owner]);assert.ok(!JSON.stringify(rows.rows).includes(token));
 await assert.rejects(confirmEmailVerification(db,'another-owner',token),/INVALID_VERIFICATION/);
 const matching=randomUUID(),otherOwner=randomUUID(),otherEmail=randomUUID();mailboxCaseIds.push(matching,otherOwner,otherEmail);
 for(const [id,caseOwner,clientEmail] of [[matching,owner,email.toUpperCase()],[otherOwner,randomUUID(),email],[otherEmail,owner,'other-fixture@example.com']]){
  await pool.query("INSERT INTO advocacy_cases(id,owner_id,title) VALUES($1,$2,'Mailbox verification fixture')",[id,caseOwner]);
  await pool.query('INSERT INTO advocacy_case_mailboxes(case_id,inbox_id,email,client_email) VALUES($1,$2,$3,$4)',[id,`mailbox-${id}`,`advocate-${id}@example.com`,clientEmail]);
 }
 await confirmEmailVerification(db,owner,token);assert.equal(await verifiedOwnerEmail(pool,owner),email);
 const mailboxes=await pool.query('SELECT case_id,client_email_verified_at FROM advocacy_case_mailboxes WHERE case_id=ANY($1::uuid[])',[mailboxCaseIds]);
 assert.ok(mailboxes.rows.find(row=>row.case_id===matching).client_email_verified_at);
 assert.equal(mailboxes.rows.find(row=>row.case_id===otherOwner).client_email_verified_at,null);
 assert.equal(mailboxes.rows.find(row=>row.case_id===otherEmail).client_email_verified_at,null);
 await assert.rejects(confirmEmailVerification(db,owner,token),/INVALID_VERIFICATION/);
 await pool.query('UPDATE neon_auth."user" SET email=$2 WHERE id=$1',[owner,`changed-${owner}@example.com`]);assert.equal(await verifiedOwnerEmail(pool,owner),null);
});

test('verified email claim preserves full narrative, queues advocate and retry returns same case',async()=>{
 Object.assign(process.env,{ASSURANCE_CASE_ENGINE:'naive',NAIVE_CASE_PROVISIONING_ENABLED:'true',ASSURANCE_FIRM_ENABLED:'false'});
 const body='Fictional workplace injury account. '.repeat(300),lead=randomUUID();
 await pool.query("INSERT INTO advocacy_email_leads(id,inbox_id,message_id,sender,subject,body) VALUES($1,'public-fixture',$2,$3,'Injury at work',$4)",[lead,randomUUID(),email,body]);
 const input={leadId:lead,ownerId:owner,verifiedEmail:email,emailVerified:true,caseType:'workplace_injury' as const};
 const first=await claimEmailLead(db,input),retry=await claimEmailLead(db,input);assert.equal(first.id,retry.id);
 const item=(await pool.query('SELECT case_type,owner_id FROM advocacy_cases WHERE id=$1',[first.id])).rows[0];assert.equal(item.case_type,'workplace_injury');assert.equal(item.owner_id,owner);
 const messages=await pool.query('SELECT body FROM advocacy_case_messages WHERE case_id=$1',[first.id]);assert.ok(messages.rows.some(row=>row.body===body));
 assert.equal((await pool.query('SELECT id FROM advocacy_case_authorities WHERE case_id=$1',[first.id])).rowCount,1);
});
