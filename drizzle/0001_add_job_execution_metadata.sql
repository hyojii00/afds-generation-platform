ALTER TABLE "generation_jobs" DROP CONSTRAINT "generation_jobs_status_check";--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "available_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "fencing_token" uuid;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "failure_reason" text;--> statement-breakpoint
CREATE INDEX "generation_jobs_claimable_idx" ON "generation_jobs" USING btree ("available_at") WHERE "generation_jobs"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "generation_jobs_expired_lease_idx" ON "generation_jobs" USING btree ("lease_expires_at") WHERE "generation_jobs"."status" = 'processing';--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_status_check" CHECK ("generation_jobs"."status" in ('queued', 'processing', 'succeeded', 'failed'));