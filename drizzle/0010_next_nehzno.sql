ALTER TABLE "advocacy_crew_runs" ADD COLUMN "poll_after" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "advocacy_crew_runs" ADD COLUMN "poll_lease_id" uuid;--> statement-breakpoint
ALTER TABLE "advocacy_crew_runs" ADD COLUMN "poll_lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "advocacy_crew_runs" ADD COLUMN "poll_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "advocacy_crew_runs" ADD COLUMN "poll_status" text;--> statement-breakpoint
ALTER TABLE "advocacy_crew_runs" ADD COLUMN "poll_invocation_id" text;