import {betterAuth} from 'better-auth';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {phoneNumber,bearer,jwt} from 'better-auth/plugins';
import {drizzle} from 'drizzle-orm/node-postgres';
import {createHash,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {phoneAuthSchema} from './phone-schema';
import {normalizedPhone,sendPhoneText,phoneOwner,isTestPhone,phoneTestCode,phoneSmsProvider,sendVerifyCode,checkVerifyCode} from './phone-messaging';
export function createPhoneAuth(pool:Pool,config:{baseURL:string;secret:string;rateLimit?:boolean;send?:typeof fetch;sendOTP?:(phone:string,code:string)=>Promise<void>}){
 const provider=phoneSmsProvider();
 const rateRule=(max:number)=>async(request:Request)=>{const body=await request.clone().json().catch(()=>null);return isTestPhone(body?.phoneNumber)?false:{window:300,max};};
 if(config.secret.length<32)throw Error('PHONE_AUTH_SECRET_REQUIRED');
 return betterAuth({appName:'Assurance',baseURL:config.baseURL,basePath:'/auth',secret:config.secret,
  database:drizzleAdapter(drizzle(pool),{provider:'pg',schema:phoneAuthSchema,transaction:true}),
  trustedOrigins:['https://assurance.claims','https://assurance-claims.vercel.app','http://localhost:5173','http://localhost:4173'],
  user:{additionalFields:{linkedOwnerId:{type:'string',required:false,input:false}}},
  emailAndPassword:{enabled:false},onAPIError:{onError:()=>{}},logger:{disabled:true},session:{expiresIn:86400},
  advanced:{database:{generateId:'uuid'}},
  rateLimit:{enabled:config.rateLimit??true,storage:'database',window:60,max:100,customRules:{'/phone-number/send-otp':rateRule(3),'/phone-number/verify':rateRule(8)}},
  plugins:[bearer(),jwt({jwt:{issuer:config.baseURL,audience:'assurance-cases',expirationTime:'5m',getSubject:({user})=>phoneOwner(user.id),definePayload:()=>({})}}),
   phoneNumber({otpLength:6,expiresIn:300,allowedAttempts:3,requireVerification:true,phoneNumberValidator:p=>!!normalizedPhone(p),
    sendOTP:async({phoneNumber:phone,code})=>{
     if(isTestPhone(phone)){await pool.query('UPDATE advocacy_phone_verifications SET value=$2 WHERE identifier=$1',[`phone-number-otp-${phone}`,`${phoneTestCode()}:0`]);return;}
     if(config.sendOTP)return config.sendOTP(phone,code);
     const allowed=await pool.query(`INSERT INTO advocacy_phone_rate_limits(id,key,count,last_request) VALUES($1,$2,1,(extract(epoch FROM now())*1000)::bigint)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN advocacy_phone_rate_limits.last_request<(extract(epoch FROM now())*1000)::bigint-300000 THEN 1 ELSE advocacy_phone_rate_limits.count+1 END,
      last_request=CASE WHEN advocacy_phone_rate_limits.last_request<(extract(epoch FROM now())*1000)::bigint-300000 THEN (extract(epoch FROM now())*1000)::bigint ELSE advocacy_phone_rate_limits.last_request END
      WHERE advocacy_phone_rate_limits.count<3 OR advocacy_phone_rate_limits.last_request<(extract(epoch FROM now())*1000)::bigint-300000 RETURNING id`,[randomUUID(),`otp-recipient:${phone}`]);
     if(!allowed.rowCount)throw Error('Please wait before requesting another code.');
     if(provider==='twilio_verify')await sendVerifyCode(phone,config.send);
     else if(provider==='agentphone')await sendPhoneText(phone,`Assurance sign-in code: ${code}. Expires in 5 minutes. Do not share this code with anyone.`,config.send,{signInCode:true});
     else throw Error('PHONE_SMS_PROVIDER_UNSUPPORTED');},
    ...(provider==='twilio_verify'?{verifyOTP:async({phoneNumber:phone,code}:{phoneNumber:string;code:string})=>{
     const client=await pool.connect();try{await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`phone-verify:${phone}`]);
      const {rows:[row]}=await client.query('SELECT * FROM advocacy_phone_verifications WHERE identifier=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE',[`phone-number-otp-${phone}`]);
      if(!row||new Date(row.expires_at)<=new Date()||Number(row.value.split(':')[1]??0)>=3){await client.query('ROLLBACK');return false;}
      const valid=isTestPhone(phone)?code===phoneTestCode():await checkVerifyCode(phone,code,config.send);
      if(valid)await client.query('DELETE FROM advocacy_phone_verifications WHERE identifier=$1',[`phone-number-otp-${phone}`]);
      else await client.query('UPDATE advocacy_phone_verifications SET value=$2 WHERE id=$1',[row.id,`${row.value.split(':')[0]}:${Number(row.value.split(':')[1]??0)+1}`]);
      await client.query('COMMIT');return valid;
     }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    }}:{}),
    signUpOnVerification:{getTempEmail:p=>`${createHash('sha256').update(p).digest('hex')}@phone.assurance.invalid`,getTempName:()=> 'Assurance caller'},
   }),
  ],
 });
}
