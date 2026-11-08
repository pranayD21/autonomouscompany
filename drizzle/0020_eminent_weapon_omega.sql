CREATE TABLE "advocacy_case_agent_setups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"authority_id" uuid NOT NULL,
	"requested_by" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_agent_setups" ADD CONSTRAINT "advocacy_case_agent_setups_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_agent_setups" ADD CONSTRAINT "advocacy_case_agent_setups_authority_id_advocacy_case_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."advocacy_case_authorities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_agent_setup_authority_idx" ON "advocacy_case_agent_setups" USING btree ("authority_id");