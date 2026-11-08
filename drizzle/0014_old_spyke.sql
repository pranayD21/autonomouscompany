CREATE TABLE "advocacy_call_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"turns" jsonb NOT NULL,
	"sha256" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_call_evidence" ADD CONSTRAINT "advocacy_call_evidence_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_call_evidence" ADD CONSTRAINT "advocacy_call_evidence_action_id_advocacy_outreach_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."advocacy_outreach_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_call_evidence_receipt_hash_idx" ON "advocacy_call_evidence" USING btree ("action_id","sha256");--> statement-breakpoint
CREATE INDEX "advocacy_call_evidence_case_idx" ON "advocacy_call_evidence" USING btree ("case_id");