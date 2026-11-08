CREATE TABLE "advocacy_phone_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"phone" text NOT NULL,
	"state" text DEFAULT 'dispatching' NOT NULL,
	"agent_id" text NOT NULL,
	"number_id" text NOT NULL,
	"consent" text NOT NULL,
	"provider_id" text,
	"provider_status" text,
	"intended_case_id" uuid NOT NULL,
	"case_id" uuid,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transcript_sha256" text,
	"reason" text,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advocacy_phone_onboarding_owner_id_unique" UNIQUE("owner_id"),
	CONSTRAINT "advocacy_phone_onboarding_provider_id_unique" UNIQUE("provider_id"),
	CONSTRAINT "advocacy_phone_onboarding_intended_case_id_unique" UNIQUE("intended_case_id")
);
--> statement-breakpoint
ALTER TABLE "advocacy_phone_onboarding" ADD CONSTRAINT "advocacy_phone_onboarding_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_onboarding_poll_idx" ON "advocacy_phone_onboarding" USING btree ("state","next_check_at");