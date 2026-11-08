CREATE TABLE "advocacy_phone_auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_phone_events" (
	"id" text PRIMARY KEY NOT NULL,
	"payload_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocacy_phone_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" text NOT NULL,
	"phone" text NOT NULL,
	"stage" text DEFAULT 'consent' NOT NULL,
	"sms_consent" boolean DEFAULT false NOT NULL,
	"case_type" text,
	"narrative" text,
	"owner_id" text,
	"case_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "advocacy_phone_intakes_call_id_unique" UNIQUE("call_id")
);
--> statement-breakpoint
CREATE TABLE "advocacy_phone_jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"alg" text,
	"crv" text
);
--> statement-breakpoint
CREATE TABLE "advocacy_phone_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedupe_key" text NOT NULL,
	"owner_id" text,
	"intake_id" uuid,
	"case_id" uuid,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"provider_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "advocacy_phone_notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "advocacy_phone_preferences" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"sms_consent" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advocacy_phone_preferences_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "advocacy_phone_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "advocacy_phone_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "advocacy_phone_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advocacy_phone_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "advocacy_phone_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advocacy_phone_users_email_unique" UNIQUE("email"),
	CONSTRAINT "advocacy_phone_users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "advocacy_phone_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocacy_phone_auth_accounts" ADD CONSTRAINT "advocacy_phone_auth_accounts_user_id_advocacy_phone_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."advocacy_phone_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_phone_intakes" ADD CONSTRAINT "advocacy_phone_intakes_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_phone_notifications" ADD CONSTRAINT "advocacy_phone_notifications_intake_id_advocacy_phone_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."advocacy_phone_intakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_phone_notifications" ADD CONSTRAINT "advocacy_phone_notifications_case_id_advocacy_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."advocacy_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advocacy_phone_sessions" ADD CONSTRAINT "advocacy_phone_sessions_user_id_advocacy_phone_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."advocacy_phone_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_intake_claim_idx" ON "advocacy_phone_intakes" USING btree ("phone","expires_at");