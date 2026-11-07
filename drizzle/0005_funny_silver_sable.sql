CREATE TABLE "advocacy_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_documents" ADD CONSTRAINT "advocacy_documents_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advocacy_documents_case_idx" ON "advocacy_documents" USING btree ("case_id");