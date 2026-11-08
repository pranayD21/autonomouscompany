import {sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {NaiveDeferred} from "./providers/naive-capacity";

// A 429 rejects admission; a 503 or lost response may still have applied a write.
export function isNaiveAdmissionRejected(error:unknown):boolean {
 return error instanceof NaiveDeferred||!!error&&typeof error==="object"&&"status" in error&&error.status===429;
}
export function isNaiveCapacityError(error:unknown):boolean {
 if(error instanceof NaiveDeferred)return true;
 if(!error||typeof error!=="object")return false;
 return "status" in error&&(error.status===429||error.status===503);
}
export function capacityRetryTime(error:unknown,cooldown:Date|null,now=Date.now()):Date {
 const deferred=error instanceof NaiveDeferred?error.retryAfterMs:0;
 return new Date(Math.max(now+1000,now+(Number.isFinite(deferred)?deferred:0),cooldown?.getTime()??0));
}
export async function naiveRetryAt(db:NodePgDatabase,error:unknown,fallbackMs:number):Promise<Date>{
 if(!isNaiveCapacityError(error))return new Date(Date.now()+fallbackMs);
 const result=await db.execute(sql`SELECT greatest(next_allowed_at,coalesce(lease_until,now())) AS retry_at FROM advocacy_naive_capacity WHERE id='naive'`);
 const value=result.rows[0]?.retry_at;
 return capacityRetryTime(error,value?new Date(String(value)):null);
}
