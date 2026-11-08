CREATE TABLE "advocacy_agentmail_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"payload_hash" text NOT NULL,
	"event_type" text NOT NULL,
	"inbox_id" text NOT NULL,
	"message_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"state" text DEFAULT 'received' NOT NULL,
	"case_id" uuid,
	"lead_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "advocacy_case_mailboxes" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"inbox_id" text NOT NULL,
	"email" text NOT NULL,
	"client_email" text,
	"client_email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_email_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbox_id" text NOT NULL,
	"message_id" text NOT NULL,
	"sender" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" text DEFAULT 'new' NOT NULL,
	"case_id" uuid,
	"claimed_owner" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_agentmail_events" ADD CONSTRAINT "advocacy_agentmail_events_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_agentmail_events" ADD CONSTRAINT "advocacy_agentmail_events_lead_id_advocacy_email_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."advocacy_email_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_case_mailboxes" ADD CONSTRAINT "advocacy_case_mailboxes_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_email_leads" ADD CONSTRAINT "advocacy_email_leads_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advocacy_agentmail_case_idx" ON "advocacy_agentmail_events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "advocacy_agentmail_state_idx" ON "advocacy_agentmail_events" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_mailbox_inbox_idx" ON "advocacy_case_mailboxes" USING btree ("inbox_id");--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_email_lead_message_idx" ON "advocacy_email_leads" USING btree ("inbox_id","message_id");