import {and,eq,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {crewRuns} from "./schema";
import {saveCrewCompletion,type CrewSession} from "./crew-completion";
import {naiveClient} from "./providers/naive";

export async function pollCrewReviews(db:NodePgDatabase,invocationId:string,readSession:(id:string)=>Promise<CrewSession>=id=>naiveClient().sessions.get(id)){
 const stats={checked:0,saved:0,needs_attention:0,failed:0};const started=Date.now();
 for(let n=0;n<5&&Date.now()-started<240000;n++){
  const claimed=await db.execute(sql`
   WITH due AS (
    SELECT id FROM advocacy_crew_runs WHERE completed_at IS NULL AND session_id IS NOT NULL
     AND poll_after<=now() AND created_at>now()-interval '30 days'
     AND (poll_lease_until IS NULL OR poll_lease_until<now())
    ORDER BY poll_after,id LIMIT 1 FOR UPDATE SKIP LOCKED
   ) UPDATE advocacy_crew_runs r SET poll_lease_id=gen_random_uuid(),poll_lease_until=now()+interval '10 minutes',
    poll_invocation_id=${invocationId} FROM due WHERE r.id=due.id RETURNING r.id,r.poll_lease_id`);
  const claim=claimed.rows[0] as {id:string;poll_lease_id:string}|undefined;if(!claim)break;
  const [run]=await db.select().from(crewRuns).where(eq(crewRuns.id,claim.id));
  if(!run)continue;
  const lease=and(eq(crewRuns.id,claim.id),eq(crewRuns.poll_lease_id,claim.poll_lease_id));
  const unchangedRepair=sql`${crewRuns.repair_sent_at} IS NOT DISTINCT FROM ${run.repair_sent_at?.toISOString()??null}::timestamptz`;
  try{
   const session=await readSession(run.session_id!);
   const result=await saveCrewCompletion(db,run,session);
   const stopped=result.approval_required||["completed","failed","cancelled"].includes(session.status)||session.status==="idle"&&session.stop_reason!=="awaiting_delegation";
   // A concurrently submitted correction owns the next check. Do not stop its polling.
   await db.update(crewRuns).set({poll_checked_at:new Date(),poll_status:result.saved_at?"saved":stopped?"needs_attention":"pending",
    poll_after:result.saved_at||stopped?null:sql`now()+interval '5 minutes'`,poll_lease_id:null,poll_lease_until:null})
    .where(and(lease,unchangedRepair));
   // If repair changed during this read, release only this lease, preserving its schedule.
   await db.update(crewRuns).set({poll_lease_id:null,poll_lease_until:null}).where(lease);
   stats.checked++;if(result.saved_at)stats.saved++;else if(stopped)stats.needs_attention++;
  }catch{
   await db.update(crewRuns).set({poll_checked_at:new Date(),poll_status:"check_failed",poll_after:sql`now()+interval '15 minutes'`,poll_lease_id:null,poll_lease_until:null})
    .where(and(lease,unchangedRepair,sql`${crewRuns.completed_at} IS NULL`));
   await db.update(crewRuns).set({poll_lease_id:null,poll_lease_until:null}).where(lease);
   stats.failed++;
  }
 }
 return stats;
}
