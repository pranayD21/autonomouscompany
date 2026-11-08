import {and,eq,inArray} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseAgentSessions,caseAgentEvents} from "./schema";
export async function queueCaseAgentEvent(db:NodePgDatabase,caseId:string,key:string,kind:string,payload:Record<string,unknown>){
 const runs=await db.select({id:caseAgentSessions.id}).from(caseAgentSessions).where(and(eq(caseAgentSessions.case_id,caseId),inArray(caseAgentSessions.state,["starting","running","idle"])));
 for(const run of runs){
  await db.insert(caseAgentEvents).values({run_id:run.id,event_key:key,kind,payload}).onConflictDoNothing();
  await db.update(caseAgentSessions).set({next_check_at:new Date()}).where(eq(caseAgentSessions.id,run.id));
 }
}
