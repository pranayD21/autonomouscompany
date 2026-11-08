import {createHash} from 'node:crypto';
import {and,desc,eq} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {z} from 'zod';
import {caseOutcomes,cases,firmRecords} from './schema';
import {outcomeEvidence,outcomeEvidenceMatches,type OutcomeInput} from './case-outcome';
export const firmTestFeeInput=z.object({operation_id:z.uuid(),case_id:z.uuid(),outcome_id:z.uuid(),fee_rate:z.number().min(0).max(1),reason:z.string().trim().min(1).max(4000)}).strict();
export type FirmTestFeeInput=z.infer<typeof firmTestFeeInput>;
export function calculateTestFee(report:OutcomeInput,rate:number){
 if(['pending','unknown'].includes(report.claim_decision)||report.original_responsibility_cents===null||report.final_responsibility_cents===null||report.reduction_cents===null)throw Error('SUPPORTED_FINAL_OUTCOME_REQUIRED');
 const reduction=Math.max(0,report.original_responsibility_cents-report.final_responsibility_cents);
 if(report.reduction_cents!==reduction)throw Error('OUTCOME_CALCULATION_MISMATCH');
 const fee=Math.round(reduction*rate);if(!Number.isSafeInteger(fee)||fee<0)throw Error('INVALID_TEST_FEE');
 return {reported_savings_cents:reduction,fee_cents:fee,currency:'usd',calculation_explanation:report.calculation_explanation};
}
export async function createStripeTestIntent(input:{operation_id:string;fee_cents:number},request:typeof fetch=fetch){
 const key=process.env.STRIPE_TEST_SECRET_KEY;if(!key||! /^(?:rk|sk)_test_[A-Za-z0-9]+$/.test(key))throw Error('STRIPE_TEST_KEY_REQUIRED');
 if(!Number.isSafeInteger(input.fee_cents)||input.fee_cents<=0)throw Error('POSITIVE_TEST_FEE_REQUIRED');
 const body=new URLSearchParams({amount:String(input.fee_cents),currency:'usd',confirm:'false','payment_method_types[]':'card','metadata[assurance_operation]':input.operation_id});
 const response=await request('https://api.stripe.com/v1/payment_intents',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`assurance-test-fee:${input.operation_id}`},body,signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!response.ok)throw Error(`STRIPE_TEST_HTTP_${response.status}`);
 const receipt=z.object({id:z.string().startsWith('pi_'),object:z.literal('payment_intent'),livemode:z.literal(false),amount:z.number().int(),currency:z.literal('usd'),amount_received:z.literal(0),status:z.literal('requires_payment_method')}).parse(await response.json());
 if(receipt.amount!==input.fee_cents)throw Error('STRIPE_RECEIPT_MISMATCH');
 return {provider:'stripe',provider_id:receipt.id,provider_status:receipt.status,livemode:false,amount_received_cents:0};
}
export async function recordFirmTestFee(db:NodePgDatabase,raw:FirmTestFeeInput,request:typeof fetch=fetch):Promise<Record<string,unknown>>{
 const input=firmTestFeeInput.parse(raw),key=`test-fee:${input.case_id}:${input.outcome_id}`;
 const fingerprint=createHash('sha256').update(JSON.stringify({case_id:input.case_id,outcome_id:input.outcome_id,fee_rate:input.fee_rate,reason:input.reason})).digest('hex');
 const reservation=await db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(eq(cases.id,input.case_id)).for('update');if(!item)throw Error('NOT_FOUND');
  const [existing]=await tx.select().from(firmRecords).where(eq(firmRecords.key,key));
  if(existing){if(existing.payload.fingerprint!==fingerprint)throw Error('TEST_FEE_CONFLICT');return {existing:existing.payload};}
  const [outcome]=await tx.select().from(caseOutcomes).where(eq(caseOutcomes.case_id,item.id)).orderBy(desc(caseOutcomes.created_at),desc(caseOutcomes.id)).limit(1);
  if(!outcome||outcome.id!==input.outcome_id)throw Error('LATEST_OUTCOME_REQUIRED');
  if(!outcomeEvidenceMatches(outcome.report,await outcomeEvidence(tx,item.id)))throw Error('OUTCOME_EVIDENCE_MISMATCH');
  const calculation=calculateTestFee(outcome.report,input.fee_rate);
  const payload={...input,...calculation,fingerprint,mode:'stripe_test',paid:false,real_revenue_cents:0,attribution:'agent_reported_outcome',independently_verified:false,state:calculation.fee_cents===0?'no_fee':'reserved',evidence:outcome.report.evidence};
  await tx.insert(firmRecords).values({key,kind:'test_fee',case_id:item.id,payload,actor:'finance'});return {payload};
 });
 if(reservation.existing)return {key,...reservation.existing};
 const payload=reservation.payload!;if(payload.fee_cents===0)return {key,...payload};
 try{
  const receipt=await createStripeTestIntent({operation_id:input.operation_id,fee_cents:payload.fee_cents},request);
  const saved={...payload,...receipt,state:'test_intent_created'};await db.update(firmRecords).set({payload:saved,updated_at:new Date()}).where(and(eq(firmRecords.key,key),eq(firmRecords.kind,'test_fee')));return {key,...saved};
 }catch(error){
  const saved={...payload,state:'unknown',reason:'Test intent creation was not confirmed. Reconcile the Stripe operation before another attempt.'};
  await db.update(firmRecords).set({payload:saved,updated_at:new Date()}).where(eq(firmRecords.key,key));throw error;
 }
}
