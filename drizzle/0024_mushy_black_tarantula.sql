CREATE TABLE "advocacy_direct_case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_direct_case_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"authority_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"turns" integer DEFAULT 0 NOT NULL,
	"goal" text,
	"finish_condition" text,
	"observed_revision" integer DEFAULT 0 NOT NULL,
	"next_check_at" timestamp with time zone DEFAULT now(),
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_tool_credentials" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "advocacy_direct_case_events" ADD CONSTRAINT "advocacy_direct_case_events_run_id_advocacy_direct_case_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."advocacy_direct_case_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_direct_case_runs" ADD CONSTRAINT "advocacy_direct_case_runs_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_direct_case_runs" ADD CONSTRAINT "advocacy_direct_case_runs_authority_id_advocacy_case_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."advocacy_case_authorities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_direct_case_runs" ADD CONSTRAINT "advocacy_direct_case_runs_credential_id_advocacy_case_tool_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."advocacy_case_tool_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_direct_event_idx" ON "advocacy_direct_case_events" USING btree ("run_id","event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_direct_authority_idx" ON "advocacy_direct_case_runs" USING btree ("authority_id");