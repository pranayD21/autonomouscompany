import {createHash,randomBytes} from "node:crypto";
import {and,eq,isNull,gt} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseToolCredentials,cases} from "./schema";
export const toolTokenHash=(value:string)=>createHash("sha256").update(value).digest("hex");
export async function issueCaseToolCredential(db:NodePgDatabase,caseId:string,owner:string){
 const [item]=await db.select({id:cases.id}).from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,owner)));
 if(!item)throw Error("NOT_FOUND");
 const token=`assurance_case_${randomBytes(32).toString("base64url")}`;
 const [saved]=await db.insert(caseToolCredentials).values({case_id:caseId,issued_by:owner,token_hash:toolTokenHash(token),expires_at:new Date(Date.now()+86400000)}).returning({id:caseToolCredentials.id,expires_at:caseToolCredentials.expires_at});
 return {...saved,token};
}
export async function resolveCaseToolCredential(db:NodePgDatabase,token:string){
 const [saved]=await db.select({id:caseToolCredentials.id,case_id:caseToolCredentials.case_id,owner_id:cases.owner_id}).from(caseToolCredentials).innerJoin(cases,eq(cases.id,caseToolCredentials.case_id)).where(and(eq(caseToolCredentials.token_hash,toolTokenHash(token)),isNull(caseToolCredentials.revoked_at),gt(caseToolCredentials.expires_at,new Date()),eq(caseToolCredentials.issued_by,cases.owner_id)));
 if(!saved||!(process.env.CREW_ALLOWED_USER_IDS??"").split(",").includes(saved.owner_id))return null;
 return saved;
}
