import {test} from 'node:test';import assert from 'node:assert/strict';
import {sendOutreach,readOutreach} from '../backend/providers/outreach';
import {fetchReplies} from '../backend/providers/replies';
import {verifiedOwnerEmail} from '../backend/verified-email';
import type {OutreachAction} from '../backend/schema';
const action={id:'action',case_id:'case',kind:'email',destination:'recipient@example.com',subject:'Case',body:'An update',provider_inbox_id:'case-inbox',provider_id:'message',provider_thread_id:'thread',approved_at:new Date(),reply_to_message_id:null,reply_thread_id:null} as OutreachAction;
test('email sends, receipts and reply reads retain the action inbox after configuration changes',async()=>{
 process.env.AGENTMAIL_API_KEY='fixture';process.env.AGENTMAIL_INBOX_ID='changed-global';const urls:string[]=[];
 const request=(async(url:unknown,init?:RequestInit)=>{urls.push(String(url));if(init?.method==='POST'){assert.equal(new Headers(init.headers).get('Idempotency-Key'),'action');return Response.json({message_id:'message',thread_id:'thread'});}if(String(url).includes('/threads/'))return Response.json({inbox_id:'case-inbox',thread_id:'thread',messages:[]});return Response.json({message_id:'message',labels:['sent']});}) as typeof fetch;
 await sendOutreach(action,request);await readOutreach(action,request);await fetchReplies(action,request);
 assert.equal(urls.length,3);assert.ok(urls.every(url=>url.includes('/inboxes/case-inbox/')));
});
test('thread followup sends through original mailbox and requires matching receipt',async()=>{
 let sends=0;const request=(async(url:unknown)=>{sends++;assert.match(String(url),/case-inbox\/messages\/message\/reply$/);return Response.json({message_id:'new',thread_id:'wrong'});}) as typeof fetch;
 await assert.rejects(sendOutreach({...action,reply_to_message_id:'message',reply_thread_id:'thread'},request),/REPLY_THREAD_MISMATCH/);assert.equal(sends,1);
});
test('verified owner email reads server auth state, rejects phone identities and unverified rows',async()=>{
 let calls=0;const pool={query:async(query:string,args:string[])=>{calls++;assert.match(query,/"emailVerified" = true/);assert.deepEqual(args,['owner']);return {rows:[{email:'Owner@Example.com'}]};}};
 assert.equal(await verifiedOwnerEmail(pool as never,'owner'),'owner@example.com');assert.equal(await verifiedOwnerEmail(pool as never,'phone:someone'),null);assert.equal(calls,1);
 assert.equal(await verifiedOwnerEmail({query:async()=>({rows:[]})} as never,'owner'),null);
});
