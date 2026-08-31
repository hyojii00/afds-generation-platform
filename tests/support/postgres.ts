import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const migrationsFolder = resolve(process.cwd(), "drizzle");

export async function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("afds_generation_platform")
    .withUsername("afds")
    .withPassword("afds")
    .start();
}

export async function migrateDatabase(
  connectionString: string,
  folder = migrationsFolder,
): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}

/**
 * Copies the migration folder while keeping only the first `count` journal
 * entries, so a test can migrate to an earlier schema and then upgrade it with
 * the same migration files production uses.
 */
export async function migrationsFolderUpTo(count: number): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "afds-migrations-"));
  await cp(migrationsFolder, folder, { recursive: true });

  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries: unknown[];
  };
  journal.entries = journal.entries.slice(0, count);
  await writeFile(journalPath, JSON.stringify(journal, null, 2));

  return folder;
}
