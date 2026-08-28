import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const generationJobsTable = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey(),
    prompt: text("prompt").notNull(),
    provider: text("provider", { enum: ["mock"] }).notNull(),
    status: text("status", { enum: ["queued"] }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    check("generation_jobs_provider_check", sql`${table.provider} = 'mock'`),
    check("generation_jobs_status_check", sql`${table.status} = 'queued'`),
  ],
);
