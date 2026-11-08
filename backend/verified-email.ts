import type {Pool} from 'pg';
import {z} from 'zod';
/** Read trusted managed-auth state after requestIdentity verifies the session. */
export async function verifiedOwnerEmail(pool:Pick<Pool,'query'>,ownerId:string):Promise<string|null>{
 if(ownerId.startsWith('phone:'))return null;
 const result=await pool.query(`SELECT u.email FROM neon_auth."user" u WHERE u.id = $1 AND (u."emailVerified" = true OR EXISTS (SELECT 1 FROM advocacy_firm_records r WHERE r.key = 'verified-email:' || u.id AND r.kind = 'email_verification' AND r.payload->>'email' = lower(u.email)))`,[ownerId]);
 const email=result.rows[0]?.email;
 return typeof email==='string'&&z.email().safeParse(email).success?email.trim().toLowerCase():null;
}
