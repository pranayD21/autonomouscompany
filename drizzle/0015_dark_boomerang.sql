CREATE TABLE "advocacy_case_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"requested_url" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"quote" text NOT NULL,
	"sha256" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_case_sources" ADD CONSTRAINT "advocacy_case_sources_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_source_operation_idx" ON "advocacy_case_sources" USING btree ("case_id","operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "advocacy_case_source_hash_idx" ON "advocacy_case_sources" USING btree ("case_id","sha256");