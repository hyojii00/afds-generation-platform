ALTER TABLE "generation_jobs" DROP CONSTRAINT "generation_jobs_status_check";--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "callback_token_hash" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "awaiting_deadline" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "generation_jobs_expired_wait_idx" ON "generation_jobs" USING btree ("awaiting_deadline") WHERE "generation_jobs"."status" = 'awaiting_provider';--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_status_check" CHECK ("generation_jobs"."status" in ('queued', 'processing', 'awaiting_provider', 'succeeded', 'failed'));