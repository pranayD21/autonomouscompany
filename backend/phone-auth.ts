import {betterAuth} from 'better-auth';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {phoneNumber,bearer,jwt} from 'better-auth/plugins';
import {drizzle} from 'drizzle-orm/node-postgres';
import {createHash,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {phoneAuthSchema} from './phone-schema';
import {normalizedPhone,sendPhoneText,phoneOwner} from './phone-messaging';
export function createPhoneAuth(pool:Pool,config:{baseURL:string;secret:string;rateLimit?:boolean;sendOTP?:(phone:string,code:string)=>Promise<void>}){
 if(config.secret.length<32)throw Error('PHONE_AUTH_SECRET_REQUIRED');
 return betterAuth({appName:'Assurance',baseURL:config.baseURL,basePath:'/auth',secret:config.secret,
  database:drizzleAdapter(drizzle(pool),{provider:'pg',schema:phoneAuthSchema,transaction:true}),
  trustedOrigins:['https://assurance.claims','https://assurance-claims.vercel.app','http://localhost:5173','http://localhost:4173'],
  user:{additionalFields:{linkedOwnerId:{type:'string',required:false,input:false}}},
  emailAndPassword:{enabled:false},onAPIError:{onError:()=>{}},logger:{disabled:true},session:{expiresIn:86400},
  advanced:{database:{generateId:'uuid'}},
  rateLimit:{enabled:config.rateLimit??true,storage:'database',window:60,max:100,customRules:{'/phone-number/send-otp':{window:300,max:3},'/phone-number/verify':{window:300,max:8}}},
  plugins:[bearer(),jwt({jwt:{issuer:config.baseURL,audience:'assurance-cases',expirationTime:'5m',getSubject:({user})=>phoneOwner(user.id),definePayload:()=>({})}}),
   phoneNumber({otpLength:6,expiresIn:300,allowedAttempts:3,requireVerification:true,phoneNumberValidator:p=>!!normalizedPhone(p),
    sendOTP:async({phoneNumber:phone,code})=>{if(config.sendOTP)return config.sendOTP(phone,code);
     const allowed=await pool.query(`INSERT INTO advocacy_phone_rate_limits(id,key,count,last_request) VALUES($1,$2,1,(extract(epoch FROM now())*1000)::bigint)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN advocacy_phone_rate_limits.last_request<(extract(epoch FROM now())*1000)::bigint-300000 THEN 1 ELSE advocacy_phone_rate_limits.count+1 END,
      last_request=CASE WHEN advocacy_phone_rate_limits.last_request<(extract(epoch FROM now())*1000)::bigint-300000 THEN (extract(epoch FROM now())*1000)::bigint ELSE advocacy_phone_rate_limits.last_request END
      WHERE advocacy_phone_rate_limits.count<3 OR advocacy_phone_rate_limits.last_request<(extract(epoch FROM now())*1000)::bigint-300000 RETURNING id`,[randomUUID(),`otp-recipient:${phone}`]);
     if(!allowed.rowCount)throw Error('Please wait before requesting another code.');
     await sendPhoneText(phone,`Assurance sign-in code: ${code}. Expires in 5 minutes. Do not share this code with anyone.`);},
    signUpOnVerification:{getTempEmail:p=>`${createHash('sha256').update(p).digest('hex')}@phone.assurance.invalid`,getTempName:()=> 'Assurance caller'},
   }),
  ],
 });
}
