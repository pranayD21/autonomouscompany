import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyAgentMailSignature,AGENTMAIL_EVENT_TYPES} from '../backend/agentmail-webhook';
const secret=`whsec_${Buffer.from('test-signing-secret').toString('base64')}`;
const now=1700000000000,raw='{"event_id":"test"}';
function headers(timestamp=now/1000){return new Headers({'svix-id':'msg_test','svix-timestamp':String(timestamp),'svix-signature':`v1,${createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`msg_test.${timestamp}.${raw}`).digest('base64')}`});}
test('Svix verifies exact raw body and accepts rotated signature list',()=>{const h=headers();assert.equal(verifyAgentMailSignature(raw,h,secret,now),true);h.set('svix-signature',`v1,invalid ${h.get('svix-signature')}`);assert.equal(verifyAgentMailSignature(raw,h,secret,now),true);assert.equal(verifyAgentMailSignature(raw+' ',h,secret,now),false);});
test('Svix rejects stale, future, missing headers and wrong secret',()=>{for(const offset of [-301,301])assert.equal(verifyAgentMailSignature(raw,headers(now/1000+offset),secret,now),false);assert.equal(verifyAgentMailSignature(raw,new Headers(),secret,now),false);assert.equal(verifyAgentMailSignature(raw,headers(),'whsec_d3Jvbmc=',now),false);});
test('subscriptions include flagged mail and outbound failure events',()=>{assert.deepEqual(AGENTMAIL_EVENT_TYPES,['message.received','message.received.spam','message.received.unauthenticated','message.bounced','message.rejected']);});
