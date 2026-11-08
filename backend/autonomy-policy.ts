import {z} from "zod";

export const caseAuthority=z.object({
 synthetic:z.literal(true),
 goal:z.string().trim().min(10).max(1000),
 contacts:z.array(z.object({id:z.string().regex(/^[a-z0-9_-]{1,40}$/),role:z.enum(["customer","insurer"]),
  channel:z.enum(["email","call"]),destination:z.string().trim().min(1).max(254),
 }).strict().superRefine((c,ctx)=>{
  if(!(c.channel==="email"?z.email().safeParse(c.destination).success:/^\+[1-9]\d{7,14}$/.test(c.destination)))ctx.addIssue({code:"custom",message:"Invalid contact destination"});
 })).min(1).max(4),
 max_decisions:z.number().int().min(1).max(10),
 max_outbound:z.number().int().min(1).max(10),
 min_contact_interval_minutes:z.number().int().min(60).max(10080),
 expires_at:z.iso.datetime(),
}).strict().superRefine((a,ctx)=>{
 if(new Set(a.contacts.map(c=>c.id)).size!==a.contacts.length)ctx.addIssue({code:"custom",message:"Contact IDs must be unique"});
});
export type CaseAuthority=z.infer<typeof caseAuthority>;

const rationale={reason:z.string().trim().min(1).max(1200),evidence_refs:z.array(z.string().min(1).max(150)).max(20)};
export const caseDecision=z.discriminatedUnion("tool",[
 z.object({tool:z.literal("contact_customer"),...rationale,contact_id:z.string(),subject:z.string().trim().min(1).max(160).refine(s=>!/[\r\n]/.test(s)),body:z.string().trim().min(1).max(4000)}).strict(),
 z.object({tool:z.literal("contact_insurer"),...rationale,contact_id:z.string(),subject:z.string().trim().min(1).max(160).refine(s=>!/[\r\n]/.test(s)),body:z.string().trim().min(1).max(4000)}).strict(),
 z.object({tool:z.literal("wait_for_reply"),...rationale,minutes:z.number().int().min(5).max(10080)}).strict(),
 z.object({tool:z.literal("stop_case"),...rationale,outcome:z.enum(["goal_met","no_supported_next_step","customer_requested_stop"]),summary:z.string().trim().min(1).max(1600)}).strict(),
 z.object({tool:z.literal("request_human_help"),...rationale,question:z.string().trim().min(1).max(1000)}).strict(),
]);
export type CaseDecision=z.infer<typeof caseDecision>;
export type DecisionContext={now:Date;revoked:boolean;decisions_used:number;outbound_used:number;last_contact_at:Date|null;
 evidence_refs:string[];verified_goal_met:boolean;customer_requested_stop:boolean;uncertain_dispatch:boolean;call_enabled:boolean};

// The model chooses the next tool. This guard enforces the standing authorization.
export function checkCaseDecision(authority:CaseAuthority,decision:CaseDecision,context:DecisionContext):string|null{
 if(context.revoked)return "AUTHORIZATION_REVOKED";
 if(new Date(authority.expires_at)<=context.now)return "AUTHORIZATION_EXPIRED";
 if(context.decisions_used>authority.max_decisions)return "DECISION_LIMIT";
 if(decision.evidence_refs.some(ref=>!context.evidence_refs.includes(ref)))return "UNKNOWN_EVIDENCE";
 if(decision.tool==="request_human_help")return null;
 if(decision.tool==="stop_case"){
  if(decision.outcome==="goal_met"&&!context.verified_goal_met)return "OUTCOME_NOT_VERIFIED";
  if(decision.outcome==="customer_requested_stop"&&!context.customer_requested_stop)return "STOP_REQUEST_NOT_VERIFIED";
  return null;
 }
 if(context.customer_requested_stop)return "CUSTOMER_STOPPED";
 if(context.uncertain_dispatch)return "DISPATCH_NEEDS_RECONCILIATION";
 if(decision.tool==="wait_for_reply")return null;
 if(context.outbound_used>=authority.max_outbound)return "OUTBOUND_LIMIT";
 const contact=authority.contacts.find(c=>c.id===decision.contact_id);
 if(!contact||contact.role!==(decision.tool==="contact_customer"?"customer":"insurer"))return "CONTACT_NOT_AUTHORIZED";
 if(contact.channel==="call"&&!context.call_enabled)return "CALL_NOT_ENABLED";
 if(context.last_contact_at&&context.now.getTime()-context.last_contact_at.getTime()<authority.min_contact_interval_minutes*60000)return "CONTACT_TOO_SOON";
 return null;
}
