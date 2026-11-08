CREATE TABLE "advocacy_case_authorities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"policy" jsonb NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"decisions_used" integer DEFAULT 0 NOT NULL,
	"outbound_used" integer DEFAULT 0 NOT NULL,
	"observed_revision" integer DEFAULT 0 NOT NULL,
	"next_wake_at" timestamp with time zone DEFAULT now(),
	"last_contact_at" timestamp with time zone,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "advocacy_case_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authority_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"case_revision" integer NOT NULL,
	"input" jsonb NOT NULL,
	"session_id" text,
	"decision" jsonb,
	"state" text DEFAULT 'starting' NOT NULL,
	"action_id" uuid,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_authorities" ADD CONSTRAINT "advocacy_case_authorities_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_decisions" ADD CONSTRAINT "advocacy_case_decisions_authority_id_advocacy_case_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."advocacy_case_authorities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advocacy_authority_due_idx" ON "advocacy_case_authorities" USING btree ("next_wake_at");--> statement-breakpoint
CREATE INDEX "advocacy_authority_case_idx" ON "advocacy_case_authorities" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_decision_round_idx" ON "advocacy_case_decisions" USING btree ("authority_id","round");