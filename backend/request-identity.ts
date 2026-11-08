import {phoneLoginEnabled} from './phone-messaging';
import type {Pool} from 'pg';
import {createRemoteJWKSet,decodeJwt,jwtVerify} from 'jose';
const managedKeys=()=>createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
let neonKeys:ReturnType<typeof managedKeys>|undefined,phoneKeys:ReturnType<typeof managedKeys>|undefined;
export async function requestIdentity(token:string,pool?:Pool){
 const hinted=decodeJwt(token);const managedIssuer=new URL(process.env.NEON_AUTH_BASE_URL!).origin;
 if(hinted.iss===managedIssuer){neonKeys??=managedKeys();const {payload}=await jwtVerify(token,neonKeys,{issuer:managedIssuer,algorithms:['EdDSA']});if(!payload.sub||payload.sub.startsWith('phone:'))throw Error('INVALID_SUBJECT');return payload.sub;}
 const phoneBase=process.env.PHONE_AUTH_BASE_URL;
 if(phoneLoginEnabled()&&phoneBase&&hinted.iss===phoneBase){phoneKeys??=createRemoteJWKSet(new URL('/auth/jwks',phoneBase));const {payload}=await jwtVerify(token,phoneKeys,{issuer:phoneBase,audience:'assurance-cases',algorithms:['EdDSA']});if(!payload.sub||!/^phone:[0-9a-f-]{36}$/.test(payload.sub))throw Error('INVALID_SUBJECT');if(pool){const {rows:[user]}=await pool.query('SELECT linked_owner_id FROM advocacy_phone_users WHERE id=$1 AND phone_number_verified=true',[payload.sub.slice(6)]);if(!user)throw Error('PHONE_USER_INACTIVE');return user.linked_owner_id??payload.sub;}return payload.sub;}
 throw Error('UNKNOWN_ISSUER');
}
