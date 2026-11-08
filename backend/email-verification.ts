import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import type {Pool} from 'pg';
import {z} from 'zod';
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function requestEmailVerification(db:NodePgDatabase,pool:Pick<Pool,'query'>,owner:string,origin:string,request:typeof fetch=fetch){
 const result=await pool.query('SELECT email FROM neon_auth."user" WHERE id=$1',[owner]);const email=result.rows[0]?.email;
 if(!z.email().safeParse(email).success)throw Error('EMAIL_ACCOUNT_REQUIRED');
 const inbox=process.env.AGENTMAIL_PUBLIC_INBOX_ID||process.env.AGENTMAIL_INBOX_ID,key=process.env.AGENTMAIL_API_KEY;if(!inbox||!key)throw Error('EMAIL_NOT_CONFIGURED');
 const token=randomBytes(32).toString('base64url'),digest=hash(token),operation=randomUUID(),expires=new Date(Date.now()+30*60*1000).toISOString();
 const reserved=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`email-verification:${owner}`},0))`);
  const old=await tx.execute(sql`SELECT key FROM advocacy_firm_records WHERE key=${`email-challenge-owner:${owner}`} AND payload->>'email'=${email.toLowerCase()} AND (payload->>'expires')::timestamptz>now()`);
  if(old.rows.length)return false;
  const payload={owner,email:email.toLowerCase(),expires,digest,operation,state:'reserved'};
  await tx.execute(sql`INSERT INTO advocacy_firm_records(key,kind,payload,actor) VALUES(${`email-challenge:${digest}`},'email_challenge',${JSON.stringify(payload)}::jsonb,${owner})`);
  await tx.execute(sql`INSERT INTO advocacy_firm_records(key,kind,payload,actor) VALUES(${`email-challenge-owner:${owner}`},'email_challenge',${JSON.stringify(payload)}::jsonb,${owner}) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=now()`);
  return true;
 });
 if(!reserved)return {pending:true};
 const url=new URL('/',origin);url.searchParams.set('verify_email',token);url.hash='workspace';
 try{
  const response=await request(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/send`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':operation},body:JSON.stringify({to:[email],subject:'Verify your Assurance email',text:`Open this link while signed in to connect your email to Assurance:\n${url.href}\n\nThis link expires in 30 minutes.`,track_opens:false}),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)throw Error('VERIFICATION_SEND_UNCONFIRMED');const receipt=z.object({message_id:z.string().min(1)}).parse(await response.json());
  await db.execute(sql`UPDATE advocacy_firm_records SET payload=payload||${JSON.stringify({state:'submitted',message_id:receipt.message_id})}::jsonb,updated_at=now() WHERE key=${`email-challenge:${digest}`}`);
  return {pending:true};
 }catch{throw Error('VERIFICATION_SEND_UNCONFIRMED');}
}
export async function confirmEmailVerification(db:NodePgDatabase,owner:string,token:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('INVALID_VERIFICATION');
 return db.transaction(async tx=>{
  const result=await tx.execute(sql`SELECT payload FROM advocacy_firm_records WHERE key=${`email-challenge:${hash(token)}`} AND kind='email_challenge' FOR UPDATE`);const value=result.rows[0]?.payload as {owner:string;email:string;expires:string;used?:boolean}|undefined;
  if(!value||value.owner!==owner||value.used||Date.parse(value.expires)<Date.now())throw Error('INVALID_VERIFICATION');
  const current=await tx.execute(sql`SELECT email FROM neon_auth."user" WHERE id=${owner}`);if(String(current.rows[0]?.email).toLowerCase()!==value.email)throw Error('INVALID_VERIFICATION');
  await tx.execute(sql`INSERT INTO advocacy_firm_records(key,kind,payload,actor) VALUES(${`verified-email:${owner}`},'email_verification',${JSON.stringify({email:value.email,verified_at:new Date().toISOString()})}::jsonb,${owner}) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=now()`);
  await tx.execute(sql`UPDATE advocacy_case_mailboxes m SET client_email_verified_at=now() FROM advocacy_cases c WHERE c.id=m.case_id AND c.owner_id=${owner} AND lower(m.client_email)=${value.email}`);
  await tx.execute(sql`UPDATE advocacy_firm_records SET payload=payload||'{"used":true}'::jsonb,updated_at=now() WHERE key=${`email-challenge:${hash(token)}`}`);
  return {verified:true};
 });
}
