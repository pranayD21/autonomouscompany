import {requestIdentity} from './request-identity';
import {decodeJwt} from 'jose';
import {Hono} from 'hono';import {z} from 'zod';import type {Pool} from 'pg';
import {verifiedPhone,claimPhoneIntake,linkVerifiedPhone} from './phone-intake';import {phoneLoginEnabled} from './phone-messaging';
export function phoneRoutes(pool:Pool){
 const app=new Hono<{Variables:{userId:string}}>();
 app.use('*',async(c,next)=>{if(!phoneLoginEnabled())return c.json({error:'Phone accounts are not active yet.'},503);await next();});
 app.post('/link',async c=>{
  const owner=c.get('userId');const body=z.object({phone_token:z.string().min(20).max(10000)}).safeParse(await c.req.json().catch(()=>null));
  if(owner.startsWith('phone:')||!body.success)return c.json({error:'Sign in to your existing account before linking a verified phone.'},400);
  try{
   await requestIdentity(body.data.phone_token,pool);const payload=decodeJwt(body.data.phone_token);
   if(payload.iss!==process.env.PHONE_AUTH_BASE_URL||!payload.sub?.startsWith('phone:'))throw Error('PHONE_PROOF_REQUIRED');
   return c.json(await linkVerifiedPhone(pool,owner,payload.sub.slice(6)));
  }catch{return c.json({error:'This phone could not be linked. Verify it again, or keep the accounts separate if either already has cases.'},409);}
 });
 app.get('/intakes',async c=>{
  const phone=await verifiedPhone(pool,c.get('userId'));if(!phone)return c.json([]);
  const {rows}=await pool.query("SELECT id,case_type,narrative,created_at,case_id FROM advocacy_phone_intakes WHERE phone=$1 AND stage='portal' AND expires_at>now() AND (owner_id IS NULL OR owner_id=$2) ORDER BY created_at DESC LIMIT 10",[phone,c.get('userId')]);return c.json(rows);
 });
 app.post('/intakes/:intakeId/claim',async c=>{
  const body=z.object({confirm:z.literal(true),sms_consent:z.boolean().optional(),start_agent:z.boolean().optional()}).safeParse(await c.req.json().catch(()=>null));if(!body.success||!z.uuid().safeParse(c.req.param('intakeId')).success)return c.json({error:'Confirm that you want to continue this call intake.'},400);
  try{return c.json({case_id:await claimPhoneIntake(pool,c.get('userId'),c.req.param('intakeId'),body.data.sms_consent,body.data.start_agent===true)});}catch(error){if(error instanceof Error&&error.message==='DIRECT_ACTIVATION_UNAVAILABLE')return c.json({error:'Agent intake is temporarily unavailable. Your call details are saved; try again shortly.'},503);return c.json({error:'Intake not found for this verified phone account.'},404);}
 });
 app.post('/preferences',async c=>{
  const body=z.object({sms_consent:z.boolean()}).safeParse(await c.req.json().catch(()=>null));const phone=await verifiedPhone(pool,c.get('userId'));if(!body.success||!phone)return c.json({error:'A verified phone account is required.'},400);
  await pool.query('INSERT INTO advocacy_phone_preferences(owner_id,phone,sms_consent) VALUES($1,$2,$3) ON CONFLICT(owner_id) DO UPDATE SET sms_consent=$3,updated_at=now()',[c.get('userId'),phone,body.data.sms_consent]);return c.json({sms_consent:body.data.sms_consent});
 });
 app.get('/messages',async c=>{const {rows}=await pool.query("SELECT m.event_id,m.case_id,m.body,m.received_at,m.disposition FROM advocacy_mac_bridge_inbound m JOIN advocacy_cases c ON c.id=m.case_id WHERE c.owner_id=$1 ORDER BY m.received_at DESC LIMIT 30",[c.get('userId')]);return c.json(rows);});
 app.get('/notifications',async c=>{const {rows}=await pool.query('SELECT id,case_id,kind,state,reason,created_at FROM advocacy_phone_notifications WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 30',[c.get('userId')]);return c.json(rows);});
 return app;
}
