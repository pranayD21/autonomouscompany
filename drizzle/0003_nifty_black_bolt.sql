CREATE TABLE "advocacy_outreach_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"destination" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"provider_id" text,
	"provider_thread_id" text,
	"provider_status" text,
	"duration_seconds" integer,
	"error_code" text,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_outreach_actions" ADD CONSTRAINT "advocacy_outreach_actions_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advocacy_outreach_case_idx" ON "advocacy_outreach_actions" USING btree ("case_id");