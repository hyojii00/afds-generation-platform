import { resolve } from "node:path";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export async function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("afds_generation_platform")
    .withUsername("afds")
    .withPassword("afds")
    .start();
}

export async function migrateDatabase(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    });
  } finally {
    await pool.end();
  }
}
