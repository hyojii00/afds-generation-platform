CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"prompt" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "generation_jobs_provider_check" CHECK ("generation_jobs"."provider" = 'mock'),
	CONSTRAINT "generation_jobs_status_check" CHECK ("generation_jobs"."status" = 'queued')
);
