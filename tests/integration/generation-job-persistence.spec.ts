import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseService } from "../../apps/api/src/database/database.service.js";
import { PostgresGenerationJobRepository } from "../../apps/api/src/database/postgres-generation-job.repository.js";
import { migrateDatabase, startPostgres } from "../support/postgres.js";

describe("generation job PostgreSQL persistence", () => {
  let container: StartedPostgreSqlContainer;
  let database: DatabaseService;
  let repository: PostgresGenerationJobRepository;

  beforeAll(async () => {
    container = await startPostgres();
    await migrateDatabase(container.getConnectionUri());
    database = new DatabaseService(container.getConnectionUri());
    await database.assertReady();
    repository = new PostgresGenerationJobRepository(database);
  });

  afterAll(async () => {
    await database.close();
    await container.stop();
  });

  beforeEach(async () => {
    await database.pool.query("truncate table generation_jobs");
  });

  it("creates the generation jobs table from an empty database", async () => {
    const result = await database.pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'generation_jobs'",
    );

    expect(result.rows).toEqual([{ table_name: "generation_jobs" }]);
  });

  it("stores and retrieves every generation job field", async () => {
    const job = {
      id: "6430a8ca-6c92-4cc3-81f9-4f6ee93db23f",
      prompt: "A persistent cinematic sunrise",
      provider: "mock" as const,
      status: "queued" as const,
      createdAt: "2026-08-28T04:30:00.000Z",
    };

    await repository.save(job);

    await expect(repository.findById(job.id)).resolves.toEqual(job);
  });

  it("rejects an incomplete generation jobs schema", async () => {
    await database.pool.query("create schema incomplete");
    await database.pool.query(
      "create table incomplete.generation_jobs (id uuid primary key)",
    );
    const incompleteDatabaseUrl = new URL(container.getConnectionUri());
    incompleteDatabaseUrl.searchParams.set(
      "options",
      "-c search_path=incomplete",
    );
    const incompleteDatabase = new DatabaseService(
      incompleteDatabaseUrl.toString(),
    );

    try {
      await expect(incompleteDatabase.assertReady()).rejects.toThrow();
    } finally {
      await incompleteDatabase.close();
    }
  });
});
