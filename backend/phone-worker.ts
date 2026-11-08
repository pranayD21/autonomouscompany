import {parseTriggerDelivery} from "@neon/functions/triggers";
import {Hono} from 'hono';import {cors} from 'hono/cors';import {bodyLimit} from 'hono/body-limit';
import {Pool} from 'pg';import {attachDatabasePool} from '@neon/functions';
import {createPhoneAuth} from './phone-auth';import {validPhoneWebhook,smsReady,deliverPhoneNotifications} from './phone-messaging';import {handlePhoneEvent} from './phone-intake';
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace('sslmode=require','sslmode=verify-full'),max:3});attachDatabasePool(pool);
const app=new Hono();app.use('*',bodyLimit({maxSize:65536}));
app.use('/auth/*',cors({origin:o=>['https://assurance.claims','https://assurance-claims.vercel.app','http://localhost:5173','http://localhost:4173'].includes(o)?o:undefined,allowHeaders:['Content-Type','Authorization'],allowMethods:['GET','POST','OPTIONS'],credentials:true}));
app.use('/status',cors({origin:'https://assurance.claims'}));
let auth:ReturnType<typeof createPhoneAuth>|undefined;
app.get('/status',async c=>{c.header('Cache-Control','no-store');return c.json({enabled:process.env.PHONE_FLOW_ENABLED==='true',smsReady:await smsReady().catch(()=>false)});});
app.all('/auth/*',async c=>{
 if(process.env.PHONE_FLOW_ENABLED!=='true'||!process.env.PHONE_AUTH_SECRET||!process.env.PHONE_AUTH_BASE_URL)return c.json({error:'Phone sign-in is not active yet.'},503);
 const route=c.req.path.slice('/auth'.length);const allowed:Record<string,string>={'/phone-number/send-otp':'POST','/phone-number/verify':'POST','/get-session':'GET','/token':'GET','/jwks':'GET','/sign-out':'POST'};
 if(allowed[route]!==c.req.method)return c.json({error:'Not found.'},404);
 auth??=createPhoneAuth(pool,{baseURL:process.env.PHONE_AUTH_BASE_URL,secret:process.env.PHONE_AUTH_SECRET});return auth.handler(c.req.raw);
});
app.post('/agentphone/webhook',async c=>{
 if(process.env.PHONE_FLOW_ENABLED!=='true')return c.json({text:'Assurance phone intake is not active yet. Please visit assurance dot claims.'});
 const raw=await c.req.text();if(!validPhoneWebhook(raw,c.req.raw.headers,process.env.AGENTPHONE_WEBHOOK_SECRET??''))return c.json({error:'Invalid webhook.'},401);
 const id=c.req.header('x-webhook-id');if(!id||id.length>180)return c.json({error:'Invalid webhook identity.'},400);
 const response=await handlePhoneEvent(pool,id,raw);
 // Commit intake before dispatch. A repeated webhook returns its recorded answer without requeuing.
 await deliverPhoneNotifications(pool).catch(()=>{});return c.json(response);
});
app.post('/poll',async c=>{
 const parsed=await parseTriggerDelivery(c.req.raw);
 if(!parsed.ok||parsed.invocation.type!=='schedule'||parsed.invocation.trigger.name!=='phone-notifications')return c.json({error:'Verified phone notification schedule required.'},401);
 if(process.env.PHONE_FLOW_ENABLED!=='true')return c.json({enabled:false});
 await deliverPhoneNotifications(pool);return c.json({checked:true});
});
app.onError(()=>Response.json({error:'Phone service temporarily unavailable.'},{status:503}));
export default app;
