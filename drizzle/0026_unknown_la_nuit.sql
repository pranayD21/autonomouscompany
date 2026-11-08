CREATE TABLE "advocacy_case_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"kind" text DEFAULT 'message' NOT NULL,
	"dedupe_key" text,
	"credential_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_messages" ADD CONSTRAINT "advocacy_case_messages_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_messages" ADD CONSTRAINT "advocacy_case_messages_credential_id_advocacy_case_tool_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."advocacy_case_tool_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advocacy_case_messages_case_idx" ON "advocacy_case_messages" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_messages_dedupe_idx" ON "advocacy_case_messages" USING btree ("case_id","dedupe_key");