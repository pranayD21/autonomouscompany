import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { ClaimIntake } from "./claim-input";
import type { CrewSnapshot } from "./providers/crew-result";

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
