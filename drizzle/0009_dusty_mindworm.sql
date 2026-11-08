CREATE TABLE "advocacy_reply_monitors" (
	"action_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_invocation_id" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"error_code" text
);
--> statement-breakpoint
ALTER TABLE "advocacy_reply_monitors" ADD CONSTRAINT "advocacy_reply_monitors_action_id_advocacy_outreach_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."advocacy_outreach_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advocacy_reply_monitor_due_idx" ON "advocacy_reply_monitors" USING btree ("enabled","next_check_at");