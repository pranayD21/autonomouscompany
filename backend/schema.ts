import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { CrewSnapshot } from "./providers/crew-result";

export const cases = pgTable("advocacy_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner_id: text("owner_id").notNull(),
  title: text("title").notNull(),
  bill_cents: integer("bill_cents").notNull(),
  eob_cents: integer("eob_cents").notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("new"),
  analysis: text("analysis"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("advocacy_cases_owner_idx").on(table.owner_id)]);

export type BillCase = typeof cases.$inferSelect;

// One immutable review request per case. Retrying uses the same provider idempotency key.
export const crewRuns = pgTable("advocacy_crew_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  case_id: uuid("case_id").notNull().unique().references(() => cases.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  session_id: text("session_id"),
  snapshot: jsonb("snapshot").$type<CrewSnapshot>(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Immutable draft + one dispatch attempt. Unknown outcomes require reconciliation, never auto-redial.
export const outreachActions = pgTable("advocacy_outreach_actions", {
  id: uuid("id").primaryKey(),
  case_id: uuid("case_id").notNull().references(() => cases.id, { onDelete: "restrict" }),
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
