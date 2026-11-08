CREATE TABLE "advocacy_case_agent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"accepted_seq" integer,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_case_agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"authority_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"identity_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"agent_version" integer NOT NULL,
	"session_id" text,
	"state" text DEFAULT 'starting' NOT NULL,
	"next_check_at" timestamp with time zone DEFAULT now(),
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_agent_events" ADD CONSTRAINT "advocacy_case_agent_events_run_id_advocacy_case_agent_sessions_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."advocacy_case_agent_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_agent_sessions" ADD CONSTRAINT "advocacy_case_agent_sessions_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_agent_sessions" ADD CONSTRAINT "advocacy_case_agent_sessions_authority_id_advocacy_case_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."advocacy_case_authorities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_agent_sessions" ADD CONSTRAINT "advocacy_case_agent_sessions_credential_id_advocacy_case_tool_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."advocacy_case_tool_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_agent_event_key_idx" ON "advocacy_case_agent_events" USING btree ("run_id","event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_agent_authority_idx" ON "advocacy_case_agent_sessions" USING btree ("authority_id");--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_agent_remote_idx" ON "advocacy_case_agent_sessions" USING btree ("session_id");