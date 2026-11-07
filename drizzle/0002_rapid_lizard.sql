ALTER TABLE "advocacy_crew_runs" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "advocacy_crew_runs" ADD COLUMN "completed_at" timestamp with time zone;