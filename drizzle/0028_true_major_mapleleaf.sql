CREATE TABLE "advocacy_firm_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"case_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"session_id" text,
	"lease_until" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_firm_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"tool" text NOT NULL,
	"fingerprint" text NOT NULL,
	"state" text DEFAULT 'reserved' NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_firm_records" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"case_id" uuid,
	"payload" jsonb NOT NULL,
	"actor" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_firm_staffing" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"authority_id" uuid NOT NULL,
	"state" text DEFAULT 'requested' NOT NULL,
	"budget_micro_usd" integer,
	"expected_recovery_cents" integer,
	"budget_reason" text,
	"agent_id" text,
	"board_card_id" text,
	"board_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_firm_events" ADD CONSTRAINT "advocacy_firm_events_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_firm_records" ADD CONSTRAINT "advocacy_firm_records_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_firm_staffing" ADD CONSTRAINT "advocacy_firm_staffing_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_firm_staffing" ADD CONSTRAINT "advocacy_firm_staffing_authority_id_advocacy_case_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."advocacy_case_authorities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_firm_event_key_idx" ON "advocacy_firm_events" USING btree ("event_key");