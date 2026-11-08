CREATE TABLE "advocacy_case_agent_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"source_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_case_tool_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"issued_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_agent_facts" ADD CONSTRAINT "advocacy_case_agent_facts_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_agent_facts" ADD CONSTRAINT "advocacy_case_agent_facts_credential_id_advocacy_case_tool_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."advocacy_case_tool_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_tool_credentials" ADD CONSTRAINT "advocacy_case_tool_credentials_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_fact_operation_idx" ON "advocacy_case_agent_facts" USING btree ("case_id","operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_tool_token_hash_idx" ON "advocacy_case_tool_credentials" USING btree ("token_hash");