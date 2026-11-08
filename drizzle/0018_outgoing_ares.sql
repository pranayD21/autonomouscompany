CREATE TABLE "advocacy_naive_capacity" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"next_allowed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_status" integer,
	"request_id" text
);
