CREATE TABLE "advocacy_case_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"inbox_id" text NOT NULL,
	"message_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"sender" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sha256" text NOT NULL,
	"disposition" text NOT NULL,
	"reason" text NOT NULL,
	"attachment_count" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_replies" ADD CONSTRAINT "advocacy_case_replies_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_replies" ADD CONSTRAINT "advocacy_case_replies_action_id_advocacy_outreach_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."advocacy_outreach_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_reply_provider_idx" ON "advocacy_case_replies" USING btree ("inbox_id","message_id");--> statement-breakpoint
CREATE INDEX "advocacy_reply_case_idx" ON "advocacy_case_replies" USING btree ("case_id");