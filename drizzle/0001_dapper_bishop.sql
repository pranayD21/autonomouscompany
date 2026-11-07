CREATE TABLE "advocacy_crew_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"message" text NOT NULL,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advocacy_crew_runs_case_id_unique" UNIQUE("case_id")
);
--> statement-breakpoint
ALTER TABLE "advocacy_crew_runs" ADD CONSTRAINT "advocacy_crew_runs_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE cascade ON UPDATE no action;