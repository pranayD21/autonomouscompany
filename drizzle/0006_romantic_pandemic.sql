CREATE TABLE "advocacy_document_extractions" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'preparing' NOT NULL,
	"file_id" text,
	"source_text" text,
	"session_id" text,
	"result" jsonb,
	"error_code" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_document_extractions" ADD CONSTRAINT "advocacy_document_extractions_document_id_advocacy_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."advocacy_documents"("id") ON DELETE restrict ON UPDATE no action;