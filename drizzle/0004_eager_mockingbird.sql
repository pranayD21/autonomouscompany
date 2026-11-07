ALTER TABLE "advocacy_crew_runs" DROP CONSTRAINT "advocacy_crew_runs_case_id_unique";--> statement-breakpoint
ALTER TABLE "advocacy_cases" ALTER COLUMN "bill_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "advocacy_cases" ALTER COLUMN "eob_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "advocacy_cases" ADD COLUMN "case_type" text DEFAULT 'health_insurance' NOT NULL;--> statement-breakpoint
ALTER TABLE "advocacy_cases" ADD COLUMN "intake" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "advocacy_cases" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "advocacy_crew_runs" ADD COLUMN "case_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "advocacy_outreach_actions" ADD COLUMN "case_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_crew_case_revision_idx" ON "advocacy_crew_runs" USING btree ("case_id","case_revision");