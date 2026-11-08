import {and,eq,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {crewRuns} from "./schema";
import {potentialDifference} from "./claim-input";
import {completedCrewSnapshot} from "./providers/crew-result";

export type CrewRun=typeof crewRuns.$inferSelect;
export type CrewSession=Parameters<typeof completedCrewSnapshot>[0];

// Validate against the immutable input, including when the case has since changed.
export async function saveCrewCompletion(db:NodePgDatabase,run:CrewRun,session:CrewSession){
 const captured=JSON.parse(run.message),facts=captured.case??captured;
 const difference=Number.isSafeInteger(facts.bill_cents)&&Number.isSafeInteger(facts.eob_cents)&&facts.bill_cents>=0&&facts.eob_cents>=0
  ?potentialDifference(facts.bill_cents,facts.eob_cents):null;
 const sources=(captured.documents??[]).filter((d:{confirmed_at:unknown;result:unknown})=>d.confirmed_at&&d.result);
 const snapshot=completedCrewSnapshot(session,difference,sources,captured.research,captured.correspondence?.replies);
 if(snapshot.output_valid){
  await db.update(crewRuns).set({snapshot,completed_at:new Date(),poll_after:null,poll_status:"saved"})
   .where(and(eq(crewRuns.id,run.id),sql`${crewRuns.completed_at} IS NULL`));
 }
 const [saved]=await db.select().from(crewRuns).where(eq(crewRuns.id,run.id));
 if(saved?.completed_at&&saved.snapshot)return {...saved.snapshot,saved_at:saved.completed_at};
 return {...snapshot,saved_at:null,repair_requested_at:run.repair_requested_at,repair_sent_at:run.repair_sent_at};
}
