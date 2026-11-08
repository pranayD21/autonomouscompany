import {and,desc,eq,inArray,sql} from "drizzle-orm";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {caseAuthorities,caseDecisions,cases,crewRuns,outreachActions,caseReplies} from "./schema";
import {caseAuthority,type CaseAuthority} from "./autonomy-policy";
import {destinationAllowed} from "./providers/outreach";

export async function authorizeCase(db:NodePgDatabase,caseId:string,userId:string,raw:unknown,allowed=destinationAllowed){
 const policy=caseAuthority.parse(raw),now=Date.now(),expiry=new Date(policy.expires_at).getTime();
 if(expiry<=now||expiry>now+30*86400000)throw Error("INVALID_EXPIRY");
 if(policy.contacts.some(c=>!allowed(c.channel,c.destination)))throw Error("CONTACT_NOT_ALLOWED");
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,userId))).for("update");
  if(!item)throw Error("NOT_FOUND");
  const [existing]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.case_id,caseId),inArray(caseAuthorities.state,["active","waiting","human_required"])));
  if(existing)throw Error("AUTHORITY_ALREADY_EXISTS");
  const [review]=await tx.select().from(crewRuns).where(and(eq(crewRuns.case_id,caseId),eq(crewRuns.case_revision,item.revision)));
  if(!review?.completed_at||!review.snapshot?.output_valid)throw Error("REVIEW_REQUIRED");
  const [created]=await tx.insert(caseAuthorities).values({case_id:caseId,policy,approved_by:userId}).returning();return created;
 });
}

export async function revokeCaseAuthority(db:NodePgDatabase,caseId:string,id:string,userId:string){
 const [revoked]=await db.update(caseAuthorities).set({state:"revoked",next_wake_at:null,reason:"Stopped by the case owner."})
  .where(and(eq(caseAuthorities.id,id),eq(caseAuthorities.case_id,caseId),eq(caseAuthorities.approved_by,userId),sql`EXISTS (SELECT 1 FROM advocacy_cases WHERE id=${caseId} AND owner_id=${userId})`)).returning();
 if(!revoked)throw Error("NOT_FOUND");return revoked;
}

// A decision round sees a fixed record of the case and completed communications.
export async function caseDecisionInput(db:NodePgDatabase,caseId:string,policy:CaseAuthority){
 const [item]=await db.select().from(cases).where(eq(cases.id,caseId));if(!item)throw Error("NOT_FOUND");
 const [review]=await db.select().from(crewRuns).where(eq(crewRuns.case_id,caseId)).orderBy(desc(crewRuns.case_revision)).limit(1);
 const actions=await db.select().from(outreachActions).where(eq(outreachActions.case_id,caseId)).orderBy(desc(outreachActions.created_at)).limit(20);
 const replies=await db.select().from(caseReplies).where(and(eq(caseReplies.case_id,caseId),eq(caseReplies.disposition,"accepted"))).orderBy(desc(caseReplies.received_at)).limit(20);
 const evidence_refs=[`case:${item.revision}`,...actions.map(a=>`action:${a.id}`),...replies.map(r=>`reply:${r.id}:${r.sha256}`)];
 return {case:item,authority:policy,review:review?.snapshot?.output_valid?{revision:review.case_revision,result:review.snapshot.result}:null,
  actions:actions.map(a=>({id:a.id,kind:a.kind,destination:a.destination,subject:a.subject,body:a.body,state:a.state,provider_status:a.provider_status,created_at:a.created_at})),
  replies:replies.map(r=>({id:r.id,sha256:r.sha256,sender:r.sender,body:r.body,received_at:r.received_at})),evidence_refs};
}

export async function readCaseAutonomy(db:NodePgDatabase,caseId:string,userId:string){
 const [item]=await db.select({id:cases.id}).from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,userId)));if(!item)throw Error("NOT_FOUND");
 const authorities=await db.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,caseId)).orderBy(desc(caseAuthorities.approved_at));
 const decisions=authorities.length?await db.select({id:caseDecisions.id,authority_id:caseDecisions.authority_id,round:caseDecisions.round,state:caseDecisions.state,decision:caseDecisions.decision,result:caseDecisions.result,action_id:caseDecisions.action_id,created_at:caseDecisions.created_at}).from(caseDecisions).where(inArray(caseDecisions.authority_id,authorities.map(a=>a.id))).orderBy(desc(caseDecisions.created_at)).limit(100):[];
 return {authorities,decisions};
}
