import {createHash,randomBytes} from "node:crypto";
import {and,eq,isNull,gt,or,inArray,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseToolCredentials,cases,caseAuthorities} from "./schema";
export const toolTokenHash=(value:string)=>createHash("sha256").update(value).digest("hex");
export async function issueCaseToolCredential(db:NodePgDatabase,caseId:string,owner:string,authorityId?:string){
 const [item]=await db.select({id:cases.id}).from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,owner)));
 if(!item)throw Error("NOT_FOUND");
 let expiresAt=new Date(Date.now()+86400000);
 if(authorityId){
  const [authority]=await db.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,authorityId),eq(caseAuthorities.case_id,caseId),eq(caseAuthorities.approved_by,owner)));
  if(!authority||!["active","waiting"].includes(authority.state)||!authority.policy.synthetic)throw Error("INVALID_CREDENTIAL_AUTHORITY");
  expiresAt=new Date(authority.policy.expires_at);
  if(!Number.isFinite(expiresAt.getTime())||expiresAt<=new Date()||expiresAt.getTime()>Date.now()+30*86400000)throw Error("INVALID_CREDENTIAL_EXPIRY");
 }
 const token=`assurance_case_${randomBytes(32).toString("base64url")}`;
 const [saved]=await db.insert(caseToolCredentials).values({authority_id:authorityId??null,case_id:caseId,issued_by:owner,token_hash:toolTokenHash(token),expires_at:expiresAt}).returning({id:caseToolCredentials.id,expires_at:caseToolCredentials.expires_at});
 return {...saved,token};
}
export async function resolveCaseToolCredential(db:NodePgDatabase,token:string){
 const [saved]=await db.select({id:caseToolCredentials.id,case_id:caseToolCredentials.case_id,owner_id:cases.owner_id}).from(caseToolCredentials).innerJoin(cases,eq(cases.id,caseToolCredentials.case_id)).leftJoin(caseAuthorities,eq(caseAuthorities.id,caseToolCredentials.authority_id)).where(and(eq(caseToolCredentials.token_hash,toolTokenHash(token)),isNull(caseToolCredentials.revoked_at),gt(caseToolCredentials.expires_at,new Date()),eq(caseToolCredentials.issued_by,cases.owner_id),or(isNull(caseToolCredentials.authority_id),and(eq(caseAuthorities.case_id,cases.id),eq(caseAuthorities.approved_by,cases.owner_id),inArray(caseAuthorities.state,["active","waiting"]),sql`(${caseAuthorities.policy}->>'expires_at')::timestamptz > now()`))));
 if(!saved||!(process.env.CREW_ALLOWED_USER_IDS??"").split(",").includes(saved.owner_id))return null;
 return saved;
}
