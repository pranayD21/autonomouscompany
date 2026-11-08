import {test} from 'node:test';import assert from 'node:assert/strict';
import {calculateTestFee,createStripeTestIntent} from '../backend/firm-finance';import type {OutcomeInput} from '../backend/case-outcome';
const report={claim_decision:'accepted',original_responsibility_cents:100000,final_responsibility_cents:20000,reduction_cents:80000,calculation_explanation:'100000 minus 20000 = 80000.'} as OutcomeInput;
test('test fee derives reduction from outcome and rejects pending, unknown and inconsistent calculations',()=>{
 assert.equal(calculateTestFee(report,.01).fee_cents,800);
 for(const claim_decision of ['pending','unknown'] as const)assert.throws(()=>calculateTestFee({...report,claim_decision},.01),/FINAL_OUTCOME/);
 assert.throws(()=>calculateTestFee({...report,reduction_cents:90000},.01),/CALCULATION_MISMATCH/);
 assert.throws(()=>calculateTestFee({...report,final_responsibility_cents:null},.01),/FINAL_OUTCOME/);
});
test('only test key can create unconfirmed test intent; no customer data or client secret retained',async()=>{
 let sends=0;process.env.STRIPE_TEST_SECRET_KEY='rk_test_fixture';
 const fake=(async(url:unknown,init?:RequestInit)=>{sends++;assert.equal(url,'https://api.stripe.com/v1/payment_intents');const body=new URLSearchParams(String(init?.body));assert.equal(body.get('confirm'),'false');assert.equal(body.get('amount'),'800');assert.equal(body.get('payment_method'),null);assert.equal(body.get('receipt_email'),null);assert.equal(new Headers(init?.headers).get('Idempotency-Key'),'assurance-test-fee:operation');return Response.json({id:'pi_fixture',object:'payment_intent',livemode:false,amount:800,currency:'usd',amount_received:0,status:'requires_payment_method',client_secret:'do-not-store'});}) as typeof fetch;
 const result=await createStripeTestIntent({operation_id:'operation',fee_cents:800},fake);assert.equal(result.provider_id,'pi_fixture');assert.equal(JSON.stringify(result).includes('do-not-store'),false);
 process.env.STRIPE_TEST_SECRET_KEY='sk_live_fixture';await assert.rejects(createStripeTestIntent({operation_id:'operation',fee_cents:800},fake),/TEST_KEY_REQUIRED/);assert.equal(sends,1);
});
test('live, wrong amount, paid or ambiguous provider replies cannot become a test receipt',async()=>{
 process.env.STRIPE_TEST_SECRET_KEY='rk_test_fixture';const valid={id:'pi_fixture',object:'payment_intent',livemode:false,amount:800,currency:'usd',amount_received:0,status:'requires_payment_method'};
 for(const change of [{livemode:true},{amount:801},{amount_received:800,status:'succeeded'}])await assert.rejects(createStripeTestIntent({operation_id:'operation',fee_cents:800},(async()=>Response.json({...valid,...change})) as typeof fetch));
 await assert.rejects(createStripeTestIntent({operation_id:'operation',fee_cents:800},(async()=>{throw Error('timeout');}) as typeof fetch),/timeout/);
});
