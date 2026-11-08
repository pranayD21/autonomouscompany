CREATE TABLE "advocacy_case_agent_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"pending_hash" text NOT NULL,
	"tool_name" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"decision" text NOT NULL,
	"approved_by" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_agent_approvals" ADD CONSTRAINT "advocacy_case_agent_approvals_run_id_advocacy_case_agent_sessions_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."advocacy_case_agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_approval_pending_idx" ON "advocacy_case_agent_approvals" USING btree ("run_id","pending_hash");