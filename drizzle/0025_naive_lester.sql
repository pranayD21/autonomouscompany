CREATE TABLE "advocacy_mac_bridge_deliveries" (
	"notification_id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"destination" text NOT NULL,
	"transport" text NOT NULL,
	"state" text DEFAULT 'claimed' NOT NULL,
	"provider_id" text,
	"reason" text,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advocacy_mac_bridge_deliveries_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "advocacy_mac_bridge_inbound" (
	"event_id" text PRIMARY KEY NOT NULL,
	"payload_hash" text NOT NULL,
	"phone" text NOT NULL,
	"body" text NOT NULL,
	"case_id" uuid,
	"disposition" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_mac_bridge_status" (
	"id" text PRIMARY KEY NOT NULL,
	"ready" boolean NOT NULL,
	"transport" text NOT NULL,
	"sender_label" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_mac_bridge_deliveries" ADD CONSTRAINT "advocacy_mac_bridge_deliveries_notification_id_advocacy_phone_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."advocacy_phone_notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_mac_bridge_inbound" ADD CONSTRAINT "advocacy_mac_bridge_inbound_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE no action ON UPDATE no action;