import {test} from 'node:test';import assert from 'node:assert/strict';
import {activationRequest,engineLabel,sessionNeedsProviderApproval,sessionStatus} from '../src/activation-state';
test('activation uses owner permission without invented scope or legacy caps',()=>{
 assert.deepEqual(activationRequest('  Research only; ask me before contacting anyone.  '),{authorize:true,persistent:true,policy:{version:2,consent:'Research only; ask me before contacting anyone.'}});
 assert.throws(()=>activationRequest('   '),/Describe/);
});
test('direct sessions never show Naïve confirmation controls',()=>{
 assert.equal(sessionNeedsProviderApproval({state:'human_required',engine:'direct_openai'}),false);
 assert.equal(sessionNeedsProviderApproval({state:'human_required',engine:'naive'}),true);
 assert.equal(engineLabel('direct_openai'),'Direct model');assert.equal(engineLabel('naive'),'Naïve');
});
test('completion and interruption statuses do not imply verified payment',()=>{
 assert.match(sessionStatus({state:'completed'}).detail,/does not verify a payout/);
 assert.equal(sessionStatus({state:'failed'}).label,'Work interrupted');
 assert.equal(sessionStatus({state:'waiting'}).label,'Waiting');
 assert.equal(sessionStatus({state:'queued'}).label,'Queued');
 assert.equal(sessionStatus({state:'unknown'}).label,'Status unavailable');
});
