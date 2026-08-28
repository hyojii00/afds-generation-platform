import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./apps/api/src/database/generation-jobs.schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://afds:afds@localhost:5432/afds_generation_platform",
  },
  strict: true,
  verbose: true,
});
