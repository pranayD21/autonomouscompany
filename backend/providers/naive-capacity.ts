import {randomUUID} from "node:crypto";
import {Pool} from "pg";

export class NaiveDeferred extends Error {
 readonly code="NAIVE_DEFERRED";
 constructor(readonly retryAfterMs:number){super("Naïve work is waiting for the shared request queue or a provider cooldown.");}
}
export interface CapacityStore {
 acquire(token:string):Promise<{acquired:boolean;waitMs:number}>;
 release(token:string,status:number|null,retryMs:number|null,requestId:string|null):Promise<void>;
}
export function postgresCapacity(pool:Pool):CapacityStore {
 return {
  async acquire(token){
   await pool.query("INSERT INTO advocacy_naive_capacity(id) VALUES ('naive') ON CONFLICT DO NOTHING");
   const result=await pool.query(`UPDATE advocacy_naive_capacity SET lease_id=$1,lease_until=now()+interval '35 seconds'
    WHERE id='naive' AND next_allowed_at<=now() AND (lease_until IS NULL OR lease_until<=now()) RETURNING id`,[token]);
   if(result.rowCount)return {acquired:true,waitMs:0};
   const state=await pool.query(`SELECT CASE WHEN next_allowed_at>now() THEN extract(epoch FROM (next_allowed_at-now()))*1000 ELSE 1000 END AS wait_ms FROM advocacy_naive_capacity WHERE id='naive'`);
   return {acquired:false,waitMs:Math.max(1000,Number(state.rows[0]?.wait_ms??1000))};
  },
  async release(token,status,retryMs,requestId){
   const overloaded=status===429||status===503||status===null;
   await pool.query(`UPDATE advocacy_naive_capacity SET lease_id=NULL,lease_until=NULL,
    failures=CASE WHEN $2 THEN least(failures+1,8) ELSE 0 END,
    next_allowed_at=now()+make_interval(secs=>CASE WHEN $2 THEN greatest(coalesce($3::double precision,0),least(900,30*power(2,least(failures,5)))) ELSE 1 END),
    last_status=$4,request_id=$5 WHERE id='naive' AND lease_id=$1`,[token,overloaded,retryMs===null?null:retryMs/1000,status,requestId]);
  },
 };
}
export function retryAfterMs(value:string|null,now=Date.now()):number|null {
 if(!value)return null;
 const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return seconds*1000;
 const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-now):null;
}
export function capacityFetch(store:CapacityStore,send:typeof fetch=fetch):typeof fetch {
 return async(input,init)=>{
  const token=randomUUID();
  // Defer to the durable job instead of tying up a Function or repeatedly hitting Naïve.
  for(let attempt=0;;attempt++){
   const gate=await store.acquire(token);if(gate.acquired)break;
   if(gate.waitMs>1200||attempt>=4)throw new NaiveDeferred(gate.waitMs);
   await new Promise(resolve=>setTimeout(resolve,gate.waitMs));
  }
  let response:Response;
  try{
   const signal=AbortSignal.any([AbortSignal.timeout(25000),...(init?.signal?[init.signal]:[])]);
   response=await send(input,{...init,signal});
  }catch(error){await store.release(token,null,null,null);throw error;}
  // Return the original response to the SDK. Never replay POSTs here, including uncertain timeouts.
  await store.release(token,response.status,retryAfterMs(response.headers.get("retry-after")),response.headers.get("x-request-id")?.slice(0,200)??null);
  return response;
 };
}
let sharedFetch:typeof fetch|undefined;
export function naiveFetch():typeof fetch {
 if(!process.env.DATABASE_URL)return (input,init)=>fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(25000),...(init?.signal?[init.signal]:[])])});
 if(!sharedFetch){
  const pool=new Pool({connectionString:process.env.DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:2,connectionTimeoutMillis:5000,query_timeout:5000,idleTimeoutMillis:1000,allowExitOnIdle:true});
  sharedFetch=capacityFetch(postgresCapacity(pool),(input,init)=>fetch(input,init));
 }
 return sharedFetch;
}
