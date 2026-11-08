import {queueCaseAgentEvent} from "./case-agent-events";
import {and,eq,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseReplies,cases,outreachActions,type OutreachAction} from "./schema";
import {fetchReplies,type ImportedReply} from "./providers/replies";
export async function syncReplies(db:NodePgDatabase,action:OutreachAction,userId:string,reader:(a:OutreachAction)=>Promise<{replies:ImportedReply[];partial:boolean}>=fetchReplies){
 const result=await reader(action);
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,action.case_id),eq(cases.owner_id,userId))).for("update");
  if(!item)throw new Error("CASE_NOT_FOUND");
  let imported=0,changed=0,held=0;
  for(const reply of result.replies){
   const [existing]=await tx.select().from(caseReplies).where(and(eq(caseReplies.inbox_id,reply.inbox_id),eq(caseReplies.message_id,reply.message_id)));
   if(existing){
    if(existing.case_id!==item.id||existing.thread_id!==reply.thread_id)throw new Error("REPLY_CASE_CONFLICT");
    if(existing.sha256!==reply.sha256){
     await tx.update(caseReplies).set({disposition:"held",reason:"Provider content changed after the first import. Original text is retained for reconciliation."}).where(eq(caseReplies.id,existing.id));if(existing.disposition!=="held")changed++;held++;continue;
    }
    // Never automatically release a content-conflict hold on a later retry.
    if(existing.reason.startsWith("Provider content changed")){held++;continue;}
    if(existing.disposition!==reply.disposition){await tx.update(caseReplies).set({disposition:reply.disposition,reason:reply.reason}).where(eq(caseReplies.id,existing.id));changed++;}
   }else{
    await tx.insert(caseReplies).values({...reply,case_id:item.id,action_id:action.id});imported++;if(reply.disposition==="accepted")changed++;
   }
   if(reply.disposition==="held")held++;
  }
  if(changed){await tx.update(cases).set({revision:sql`${cases.revision}+1`,analysis:null,status:"new"}).where(eq(cases.id,item.id));
   await queueCaseAgentEvent(tx,item.id,`reply-revision:${item.revision+1}`,"correspondence_changed",{revision:item.revision+1});
  }
  await tx.update(outreachActions).set({checked_at:new Date()}).where(eq(outreachActions.id,action.id));
  return {imported,changed,held,partial:result.partial,revision:item.revision+(changed?1:0)};
 });
}
