import { and, eq, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { outreachActions, caseMailboxes, firmStaffing, type OutreachAction } from "./schema";
import { DispatchFailure, sendOutreach, type DispatchResult } from "./providers/outreach";

export async function dispatchOnce(db: NodePgDatabase, action: OutreachAction, userId: string,
  sender: (a:OutreachAction)=>Promise<DispatchResult> = sendOutreach, authorityGuard?:SQL) {
  let inbox=action.provider_inbox_id;
  if(action.kind==="email" && action.state==="draft" && !inbox){
    // Replies remain bound to the original sender mailbox, including historical threads.
    if(action.reply_to_message_id){
      const [previous]=await db.select().from(outreachActions).where(and(eq(outreachActions.case_id,action.case_id),eq(outreachActions.provider_id,action.reply_to_message_id),eq(outreachActions.provider_thread_id,action.reply_thread_id!)));
      if(!previous)throw new DispatchFailure("INVALID_REPLY_CONTEXT",true);
      inbox=previous.provider_inbox_id||process.env.AGENTMAIL_INBOX_ID||null;
    }else{
      const [mailbox]=await db.select().from(caseMailboxes).where(eq(caseMailboxes.case_id,action.case_id));
      const [firm]=await db.select().from(firmStaffing).where(eq(firmStaffing.case_id,action.case_id));
      inbox=mailbox?.inbox_id||(!firm?process.env.AGENTMAIL_INBOX_ID:null)||null;
    }
    if(!inbox)throw new DispatchFailure("EMAIL_INBOX_NOT_CONFIGURED",true);
  }
  // Commit the dispatch intent before crossing the network boundary. A crash is ambiguous,
  // so dispatching/unknown rows are never automatically returned to draft.
  const [claimed]=await db.update(outreachActions).set({provider_inbox_id:inbox,state:"dispatching",approved_by:userId,approved_at:new Date()})
    .where(and(eq(outreachActions.id,action.id),eq(outreachActions.state,"draft"),authorityGuard,sql`EXISTS (SELECT 1 FROM advocacy_cases WHERE id = ${action.case_id} AND revision = ${action.case_revision} AND owner_id = ${userId})`)).returning();
  if(!claimed) {
    const [current]=await db.select().from(outreachActions).where(eq(outreachActions.id,action.id));
    return current;
  }
  try {
    const receipt=await sender(claimed);
    const [saved]=await db.update(outreachActions).set({...receipt,state:"submitted",checked_at:new Date()})
      .where(eq(outreachActions.id,action.id)).returning();
    return saved;
  } catch(error) {
    const [saved]=await db.update(outreachActions).set({state:error instanceof DispatchFailure && error.definiteRejection?"rejected":"unknown",
      error_code:error instanceof DispatchFailure?error.code:"OUTCOME_UNKNOWN"})
      .where(eq(outreachActions.id,action.id)).returning();
    return saved;
  }
}
