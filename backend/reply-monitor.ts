import {and,eq,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {cases,outreachActions,replyMonitors} from "./schema";
import {syncReplies} from "./reply-service";

export async function setReplyMonitoring(db:NodePgDatabase,caseId:string,actionId:string,userId:string,enabled:boolean){
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,userId))).for("update");
  if(!item)throw Error("NOT_FOUND");
  const [action]=await tx.select().from(outreachActions).where(and(eq(outreachActions.id,actionId),eq(outreachActions.case_id,caseId)));
  if(!action)throw Error("NOT_FOUND");
  if(action.kind!=="email"||!action.approved_at||!action.provider_id||!action.provider_thread_id)throw Error("NO_AUTHORIZED_THREAD");
  const [monitor]=await tx.insert(replyMonitors).values({action_id:actionId,enabled,expires_at:sql`now()+interval '30 days'`})
   .onConflictDoUpdate({target:replyMonitors.action_id,set:{enabled,
    expires_at:enabled?sql`now()+interval '30 days'`:replyMonitors.expires_at,
    next_check_at:sql`CASE WHEN ${replyMonitors.enabled} AND ${replyMonitors.expires_at}>now() THEN ${replyMonitors.next_check_at} ELSE now() END`,
   }}).returning();
  return monitor;
 });
}

// Every delivery claims each due thread atomically. A crashed worker loses its lease after ten minutes.
// Provider reads may repeat after a crash; reply ingestion itself is idempotent.
export async function pollReplyMonitors(db:NodePgDatabase,invocationId:string,sync:typeof syncReplies=syncReplies){
 const stats={checked:0,imported:0,changed:0,failed:0};const started=Date.now();
 for(let n=0;n<5&&Date.now()-started<240000;n++){
  const claimed=await db.execute(sql`
   WITH due AS (
    SELECT action_id FROM advocacy_reply_monitors
    WHERE enabled AND (expires_at>now() OR EXISTS (
     SELECT 1 FROM advocacy_case_decisions d JOIN advocacy_case_authorities a ON a.id=d.authority_id
     WHERE d.action_id=advocacy_reply_monitors.action_id AND a.policy->>'version'='2'
      AND a.state IN ('active','waiting','human_required')
    )) AND next_check_at<=now()
     AND (lease_until IS NULL OR lease_until<now())
    ORDER BY next_check_at,action_id LIMIT 1 FOR UPDATE SKIP LOCKED
   ) UPDATE advocacy_reply_monitors m SET lease_id=gen_random_uuid(),lease_until=now()+interval '10 minutes',
      last_attempt_at=now(),last_invocation_id=${invocationId}
    FROM due WHERE m.action_id=due.action_id RETURNING m.action_id,m.lease_id,m.failures`);
  const row=claimed.rows[0] as {action_id:string;lease_id:string;failures:number}|undefined;if(!row)break;
  try{
   const [record]=await db.select({action:outreachActions,owner:cases.owner_id}).from(outreachActions).innerJoin(cases,eq(cases.id,outreachActions.case_id)).where(eq(outreachActions.id,row.action_id));
   if(!record)throw Error("MISSING_ACTION");
   const result=await sync(db,record.action,record.owner);
   await db.update(replyMonitors).set({last_success_at:sql`now()`,next_check_at:sql`now()+interval '15 minutes'`,failures:0,error_code:result.partial?"PARTIAL_HISTORY":null,lease_id:null,lease_until:null})
    .where(and(eq(replyMonitors.action_id,row.action_id),eq(replyMonitors.lease_id,row.lease_id)));
   stats.checked++;stats.imported+=result.imported;stats.changed+=result.changed;
  }catch{
   const delay=Math.min(360,15*2**Math.min(row.failures+1,5));
   await db.update(replyMonitors).set({next_check_at:sql`now()+${delay}*interval '1 minute'`,failures:row.failures+1,error_code:"REPLY_CHECK_FAILED",lease_id:null,lease_until:null})
    .where(and(eq(replyMonitors.action_id,row.action_id),eq(replyMonitors.lease_id,row.lease_id)));
   stats.failed++;
  }
 }
 return stats;
}
