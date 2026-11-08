import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { ClaimIntake } from "./claim-input";
import type { CrewSnapshot } from "./providers/crew-result";
import type {CaseAuthority,CaseDecision} from "./autonomy-policy";

export const cases = pgTable("advocacy_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner_id: text("owner_id").notNull(),
  title: text("title").notNull(),
  case_type: text("case_type").$type<"workplace_injury" | "health_insurance">().notNull().default("health_insurance"),
  intake: jsonb("intake").$type<Partial<ClaimIntake>>().notNull().default({}),
  revision: integer("revision").notNull().default(1),
  bill_cents: integer("bill_cents"),
  eob_cents: integer("eob_cents"),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("new"),
  analysis: text("analysis"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("advocacy_cases_owner_idx").on(table.owner_id)]);

export type BillCase = typeof cases.$inferSelect;

export const caseAuthorities=pgTable("advocacy_case_authorities",{
 id:uuid("id").primaryKey().defaultRandom(),
 case_id:uuid("case_id").notNull().references(()=>cases.id,{onDelete:"restrict"}),
 policy:jsonb("policy").$type<CaseAuthority>().notNull(),
 approved_by:text("approved_by").notNull(),
 approved_at:timestamp("approved_at",{withTimezone:true}).defaultNow().notNull(),
 state:text("state").$type<"active"|"waiting"|"human_required"|"stopped"|"revoked">().notNull().default("active"),
 decisions_used:integer("decisions_used").notNull().default(0),
 outbound_used:integer("outbound_used").notNull().default(0),
 observed_revision:integer("observed_revision").notNull().default(0),
 next_wake_at:timestamp("next_wake_at",{withTimezone:true}).defaultNow(),
 last_contact_at:timestamp("last_contact_at",{withTimezone:true}),
 lease_id:uuid("lease_id"),
 lease_until:timestamp("lease_until",{withTimezone:true}),
 reason:text("reason"),
},t=>[index("advocacy_authority_due_idx").on(t.next_wake_at),index("advocacy_authority_case_idx").on(t.case_id)]);

export const caseDecisions=pgTable("advocacy_case_decisions",{
 id:uuid("id").primaryKey().defaultRandom(),
 authority_id:uuid("authority_id").notNull().references(()=>caseAuthorities.id,{onDelete:"restrict"}),
 round:integer("round").notNull(),
 case_revision:integer("case_revision").notNull(),
 input:jsonb("input").$type<Record<string,unknown>>().notNull(),
 session_id:text("session_id"),
 decision:jsonb("decision").$type<CaseDecision>(),
 state:text("state").$type<"starting"|"running"|"executing"|"finished"|"unknown">().notNull().default("starting"),
 action_id:uuid("action_id"),
 result:jsonb("result").$type<Record<string,unknown>>(),
 created_at:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
 finished_at:timestamp("finished_at",{withTimezone:true}),
},t=>[uniqueIndex("advocacy_decision_round_idx").on(t.authority_id,t.round)]);

// One immutable review request per case revision. Retrying uses the same provider idempotency key.
export const crewRuns = pgTable("advocacy_crew_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  case_revision: integer("case_revision").notNull().default(1),
  case_id: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  session_id: text("session_id"),
  snapshot: jsonb("snapshot").$type<CrewSnapshot>(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  repair_requested_at: timestamp("repair_requested_at", { withTimezone: true }),
  repair_sent_at: timestamp("repair_sent_at", { withTimezone: true }),
  poll_after: timestamp("poll_after", { withTimezone: true }).defaultNow(),
  poll_lease_id: uuid("poll_lease_id"),
  poll_lease_until: timestamp("poll_lease_until", { withTimezone: true }),
  poll_checked_at: timestamp("poll_checked_at", { withTimezone: true }),
  poll_status: text("poll_status"),
  poll_invocation_id: text("poll_invocation_id"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("advocacy_crew_case_revision_idx").on(t.case_id,t.case_revision)]);

// Immutable draft + one dispatch attempt. Unknown outcomes require reconciliation, never auto-redial.
export const outreachActions = pgTable("advocacy_outreach_actions", {
  id: uuid("id").primaryKey(),
  case_id: uuid("case_id").notNull().references(() => cases.id, { onDelete: "restrict" }),
  case_revision: integer("case_revision").notNull().default(1),
  kind: text("kind").$type<"call" | "email">().notNull(),
  destination: text("destination").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  state: text("state").$type<"draft" | "dispatching" | "submitted" | "unknown" | "rejected">().notNull().default("draft"),
  approved_by: text("approved_by"),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  provider_id: text("provider_id"),
  provider_thread_id: text("provider_thread_id"),
  provider_status: text("provider_status"),
  reply_to_message_id: text("reply_to_message_id"),
  reply_thread_id: text("reply_thread_id"),
  duration_seconds: integer("duration_seconds"),
  error_code: text("error_code"),
  checked_at: timestamp("checked_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("advocacy_outreach_case_idx").on(t.case_id)]);
export type OutreachAction = typeof outreachActions.$inferSelect;

// The row reserves immutable bytes before storage writes. A ready transition advances the case once.
export const documents = pgTable("advocacy_documents", {
  id: uuid("id").primaryKey(),
  case_id: uuid("case_id").notNull().references(() => cases.id, { onDelete: "restrict" }),
  object_key: text("object_key").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  byte_size: integer("byte_size").notNull(),
  sha256: text("sha256").notNull(),
  kind: text("kind").notNull(),
  state: text("state").$type<"uploading" | "ready">().notNull().default("uploading"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("advocacy_documents_case_idx").on(t.case_id)]);
export type CaseDocument = typeof documents.$inferSelect;

export const documentExtractions = pgTable("advocacy_document_extractions", {
 document_id:uuid("document_id").primaryKey().references(()=>documents.id,{onDelete:"restrict"}),
 state:text("state").notNull().default("preparing"),
 file_id:text("file_id"),
 source_text:text("source_text"),
 session_id:text("session_id"),
 result:jsonb("result").$type<import("./providers/document-reader").DocumentExtraction>(),
 error_code:text("error_code"),
 confirmed_at:timestamp("confirmed_at",{withTimezone:true}),
 created_at:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
});

export const caseReplies = pgTable("advocacy_case_replies", {
 id:uuid("id").primaryKey().defaultRandom(),
 case_id:uuid("case_id").notNull().references(()=>cases.id,{onDelete:"restrict"}),
 action_id:uuid("action_id").notNull().references(()=>outreachActions.id,{onDelete:"restrict"}),
 inbox_id:text("inbox_id").notNull(),
 message_id:text("message_id").notNull(),
 thread_id:text("thread_id").notNull(),
 sender:text("sender").notNull(),
 subject:text("subject").notNull(),
 body:text("body").notNull(),
 sha256:text("sha256").notNull(),
 disposition:text("disposition").$type<"accepted"|"held">().notNull(),
 reason:text("reason").notNull(),
 attachment_count:integer("attachment_count").notNull().default(0),
 received_at:timestamp("received_at",{withTimezone:true}).notNull(),
 created_at:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex("advocacy_reply_provider_idx").on(t.inbox_id,t.message_id),index("advocacy_reply_case_idx").on(t.case_id)]);
export type CaseReply=typeof caseReplies.$inferSelect;

export const replyMonitors=pgTable("advocacy_reply_monitors",{
 action_id:uuid("action_id").primaryKey().references(()=>outreachActions.id,{onDelete:"restrict"}),
 enabled:boolean("enabled").notNull().default(false),
 expires_at:timestamp("expires_at",{withTimezone:true}).notNull(),
 next_check_at:timestamp("next_check_at",{withTimezone:true}).notNull().defaultNow(),
 lease_id:uuid("lease_id"),
 lease_until:timestamp("lease_until",{withTimezone:true}),
 last_attempt_at:timestamp("last_attempt_at",{withTimezone:true}),
 last_success_at:timestamp("last_success_at",{withTimezone:true}),
 last_invocation_id:text("last_invocation_id"),
 failures:integer("failures").notNull().default(0),
 error_code:text("error_code"),
},t=>[index("advocacy_reply_monitor_due_idx").on(t.enabled,t.next_check_at)]);
export type ReplyMonitor=typeof replyMonitors.$inferSelect;

export const caseToolCredentials=pgTable("advocacy_case_tool_credentials",{
 authority_id:uuid("authority_id").references(()=>caseAuthorities.id,{onDelete:"cascade"}),
 id:uuid("id").primaryKey().defaultRandom(),
 case_id:uuid("case_id").notNull().references(()=>cases.id,{onDelete:"cascade"}),
 token_hash:text("token_hash").notNull(),
 issued_by:text("issued_by").notNull(),
 created_at:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
 expires_at:timestamp("expires_at",{withTimezone:true}).notNull(),
 revoked_at:timestamp("revoked_at",{withTimezone:true}),
},t=>[uniqueIndex("advocacy_tool_token_hash_idx").on(t.token_hash)]);

export const caseAgentFacts=pgTable("advocacy_case_agent_facts",{
 id:uuid("id").primaryKey().defaultRandom(),
 case_id:uuid("case_id").notNull().references(()=>cases.id,{onDelete:"cascade"}),
 credential_id:uuid("credential_id").notNull().references(()=>caseToolCredentials.id,{onDelete:"restrict"}),
 operation_id:uuid("operation_id").notNull(),
 statement:text("statement").notNull(),
 source_ref:text("source_ref").notNull(),
 created_at:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
},t=>[uniqueIndex("advocacy_fact_operation_idx").on(t.case_id,t.operation_id)]);

// Immutable completed-call transcript snapshots; provider speech is reported information.
export const callEvidence=pgTable("advocacy_call_evidence",{
 id:uuid("id").primaryKey().defaultRandom(),
 case_id:uuid("case_id").notNull().references(()=>cases.id,{onDelete:"restrict"}),
 action_id:uuid("action_id").notNull().references(()=>outreachActions.id,{onDelete:"restrict"}),
 provider:text("provider").$type<"agentphone"|"elevenlabs">().notNull(),
 provider_id:text("provider_id").notNull(),
 turns:jsonb("turns").$type<import("./providers/call-evidence").CallTurn[]>().notNull(),
 sha256:text("sha256").notNull(),
 received_at:timestamp("received_at",{withTimezone:true}).defaultNow().notNull(),
},t=>[uniqueIndex("advocacy_call_evidence_receipt_hash_idx").on(t.action_id,t.sha256),index("advocacy_call_evidence_case_idx").on(t.case_id)]);

export const caseSources=pgTable("advocacy_case_sources",{
 id:uuid("id").primaryKey().defaultRandom(),
 case_id:uuid("case_id").notNull().references(()=>cases.id,{onDelete:"restrict"}),
 operation_id:uuid("operation_id").notNull(),
 requested_url:text("requested_url").notNull(),url:text("url").notNull(),title:text("title").notNull(),
 text:text("text").notNull(),quote:text("quote").notNull(),sha256:text("sha256").notNull(),
 retrieved_at:timestamp("retrieved_at",{withTimezone:true}).notNull(),
},t=>[uniqueIndex("advocacy_case_source_operation_idx").on(t.case_id,t.operation_id),uniqueIndex("advocacy_case_source_hash_idx").on(t.case_id,t.sha256)]);

export const caseAgentSessions=pgTable("advocacy_case_agent_sessions",{
 id:uuid("id").primaryKey().defaultRandom(),
 case_id:uuid("case_id").notNull().references(()=>cases.id,{onDelete:"restrict"}),
 authority_id:uuid("authority_id").notNull().references(()=>caseAuthorities.id,{onDelete:"restrict"}),
 credential_id:uuid("credential_id").notNull().references(()=>caseToolCredentials.id,{onDelete:"restrict"}),
 identity_id:text("identity_id").notNull(),agent_id:text("agent_id").notNull(),agent_version:integer("agent_version").notNull(),
 session_id:text("session_id"),state:text("state").$type<"starting"|"running"|"idle"|"human_required"|"stopped">().notNull().default("starting"),
 next_check_at:timestamp("next_check_at",{withTimezone:true}).defaultNow(),
 lease_id:uuid("lease_id"),lease_until:timestamp("lease_until",{withTimezone:true}),
 reason:text("reason"),created_at:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
},t=>[uniqueIndex("advocacy_case_agent_authority_idx").on(t.authority_id),uniqueIndex("advocacy_case_agent_remote_idx").on(t.session_id)]);
export const caseAgentEvents=pgTable("advocacy_case_agent_events",{
 id:uuid("id").primaryKey().defaultRandom(),
 run_id:uuid("run_id").notNull().references(()=>caseAgentSessions.id,{onDelete:"restrict"}),
 event_key:text("event_key").notNull(),kind:text("kind").notNull(),
 payload:jsonb("payload").$type<Record<string,unknown>>().notNull(),
 accepted_seq:integer("accepted_seq"),delivered_at:timestamp("delivered_at",{withTimezone:true}),created_at:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
},t=>[uniqueIndex("advocacy_case_agent_event_key_idx").on(t.run_id,t.event_key)]);

export const caseOutcomes=pgTable("advocacy_case_outcomes",{
 id:uuid("id").primaryKey().defaultRandom(),
 case_id:uuid("case_id").notNull().references(()=>cases.id,{onDelete:"restrict"}),
 credential_id:uuid("credential_id").notNull().references(()=>caseToolCredentials.id,{onDelete:"restrict"}),
 operation_id:uuid("operation_id").notNull(),case_revision:integer("case_revision").notNull(),
 report:jsonb("report").$type<import("./case-outcome").OutcomeInput>().notNull(),
 created_at:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
},t=>[uniqueIndex("advocacy_case_outcome_operation_idx").on(t.case_id,t.operation_id)]);

// One shared admission gate across API and scheduled Functions; no case data or secrets.
export const naiveCapacity = pgTable("advocacy_naive_capacity", {
 id:text("id").primaryKey(),
 lease_id:uuid("lease_id"),
 lease_until:timestamp("lease_until",{withTimezone:true}),
 next_allowed_at:timestamp("next_allowed_at",{withTimezone:true}).defaultNow().notNull(),
 failures:integer("failures").notNull().default(0),
 last_status:integer("last_status"),
 request_id:text("request_id"),
});

export const caseAgentApprovals=pgTable("advocacy_case_agent_approvals",{
 id:uuid("id").primaryKey().defaultRandom(),
 run_id:uuid("run_id").notNull().references(()=>caseAgentSessions.id,{onDelete:"cascade"}),
 pending_hash:text("pending_hash").notNull(),
 tool_name:text("tool_name").notNull(),
 tool_call_id:text("tool_call_id").notNull(),
 decision:text("decision").$type<"allow"|"deny">().notNull(),
 approved_by:text("approved_by").notNull(),
 state:text("state").$type<"confirmed"|"uncertain">().notNull(),
 created_at:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
},t=>[uniqueIndex("advocacy_case_approval_pending_idx").on(t.run_id,t.pending_hash)]);

export const caseAgentSetups=pgTable("advocacy_case_agent_setups",{
 id:uuid("id").primaryKey().defaultRandom(),
 case_id:uuid("case_id").notNull().references(()=>cases.id,{onDelete:"cascade"}),
 authority_id:uuid("authority_id").notNull().references(()=>caseAuthorities.id,{onDelete:"cascade"}),
 requested_by:text("requested_by").notNull(),
 state:text("state").$type<"queued"|"ready"|"stopped">().notNull().default("queued"),
 attempts:integer("attempts").notNull().default(0),
 next_check_at:timestamp("next_check_at",{withTimezone:true}).defaultNow().notNull(),
 lease_id:uuid("lease_id"),lease_until:timestamp("lease_until",{withTimezone:true}),
 reason:text("reason"),created_at:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
},t=>[uniqueIndex("advocacy_case_agent_setup_authority_idx").on(t.authority_id)]);
