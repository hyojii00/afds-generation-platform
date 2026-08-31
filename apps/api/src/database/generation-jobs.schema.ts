import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const generationJobsTable = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey(),
    prompt: text("prompt").notNull(),
    provider: text("provider", { enum: ["mock"] }).notNull(),
    status: text("status", {
      enum: ["queued", "processing", "succeeded", "failed"],
    }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    availableAt: timestamp("available_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    fencingToken: uuid("fencing_token"),
    failureReason: text("failure_reason"),
    providerReference: text("provider_reference"),
  },
  (table) => [
    check("generation_jobs_provider_check", sql`${table.provider} = 'mock'`),
    check(
      "generation_jobs_status_check",
      sql`${table.status} in ('queued', 'processing', 'succeeded', 'failed')`,
    ),
    index("generation_jobs_claimable_idx")
      .on(table.availableAt)
      .where(sql`${table.status} = 'queued'`),
    index("generation_jobs_expired_lease_idx")
      .on(table.leaseExpiresAt)
      .where(sql`${table.status} = 'processing'`),
  ],
);
