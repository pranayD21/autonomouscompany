CREATE TABLE "advocacy_phone_call_cases" (
	"call_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"case_id" uuid,
	"state" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_phone_call_cases" ADD CONSTRAINT "advocacy_phone_call_cases_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_call_cases_owner_idx" ON "advocacy_phone_call_cases" USING btree ("owner_id","created_at");