CREATE TABLE "advocacy_case_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"case_revision" integer NOT NULL,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_outcomes" ADD CONSTRAINT "advocacy_case_outcomes_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_outcomes" ADD CONSTRAINT "advocacy_case_outcomes_credential_id_advocacy_case_tool_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."advocacy_case_tool_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_outcome_operation_idx" ON "advocacy_case_outcomes" USING btree ("case_id","operation_id");