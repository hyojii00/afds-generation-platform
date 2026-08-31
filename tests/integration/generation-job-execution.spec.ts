import {
  type GenerationJobLease,
  GenerationJobWorker,
  mockGenerationProvider,
  PermanentProviderError,
  TransientProviderError,
} from "@afds-generation-platform/generation";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { rm } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseService } from "../../apps/api/src/database/database.service.js";
import { PostgresGenerationJobQueue } from "../../apps/api/src/database/postgres-generation-job.queue.js";
import { HttpGenerationProvider } from "../../apps/api/src/providers/http-generation.provider.js";
import {
  type LocalProvider,
  startLocalProvider,
} from "../support/local-provider.js";
import {
  migrateDatabase,
  migrationsFolderUpTo,
  startPostgres,
} from "../support/postgres.js";

const policy = { leaseSeconds: 30, maxAttempts: 3 };

describe("generation job execution in PostgreSQL", () => {
  let container: StartedPostgreSqlContainer;
  let database: DatabaseService;
  let queue: PostgresGenerationJobQueue;

  beforeAll(async () => {
    container = await startPostgres();
    await migrateDatabase(container.getConnectionUri());
    database = new DatabaseService(container.getConnectionUri());
    await database.assertReady();
    queue = new PostgresGenerationJobQueue(database);
  });

  afterAll(async () => {
    await database.close();
    await container.stop();
  });

  beforeEach(async () => {
    await database.pool.query("truncate table generation_jobs");
  });

  async function insertQueuedJob(prompt = "A cinematic sunrise over Seoul") {
    const { rows } = await database.pool.query<{ id: string }>(
      `insert into generation_jobs (id, prompt, provider, status, created_at)
       values (gen_random_uuid(), $1, 'mock', 'queued', now())
       returning id`,
      [prompt],
    );

    const [row] = rows;
    if (!row) {
      throw new Error("expected an inserted generation job");
    }

    return row.id;
  }

  async function readJob(id: string) {
    const { rows } = await database.pool.query<{
      status: string;
      attempt_count: number;
      provider_reference: string | null;
      fencing_token: string | null;
      lease_expires_at: Date | null;
      failure_reason: string | null;
      available_at: Date;
    }>("select * from generation_jobs where id = $1", [id]);

    const [row] = rows;
    if (!row) {
      throw new Error(`expected generation job ${id}`);
    }

    return row;
  }

  async function transactionTime() {
    const { rows } = await database.pool.query<{ now: Date }>("select now()");
    const [row] = rows;
    if (!row) {
      throw new Error("expected a transaction timestamp");
    }

    return row.now;
  }

  async function expireLease(id: string) {
    await database.pool.query(
      "update generation_jobs set lease_expires_at = now() - interval '1 second' where id = $1",
      [id],
    );
  }

  it("upgrades the Loop 002 schema without losing existing jobs", async () => {
    await database.pool.query("create database loop_002_upgrade");
    const upgradeUrl = new URL(container.getConnectionUri());
    upgradeUrl.pathname = "/loop_002_upgrade";
    const connectionString = upgradeUrl.toString();
    const migrationsWindow = await migrationsFolderUpTo(1);
    await migrateDatabase(connectionString, migrationsWindow);

    const pool = new Pool({ connectionString });
    const upgraded = new DatabaseService(connectionString);
    try {
      const { rows: inserted } = await pool.query<{ id: string }>(
        `insert into generation_jobs (id, prompt, provider, status, created_at)
         values (gen_random_uuid(), 'A job accepted before Loop 003', 'mock', 'queued', now())
         returning id`,
      );
      const id = inserted[0]?.id;

      await migrateDatabase(connectionString);

      const { rows } = await pool.query("select * from generation_jobs");
      expect(rows).toEqual([
        expect.objectContaining({
          id,
          prompt: "A job accepted before Loop 003",
          status: "queued",
          attempt_count: 0,
          fencing_token: null,
          lease_expires_at: null,
        }),
      ]);

      const upgradedQueue = new PostgresGenerationJobQueue(upgraded);
      const lease = await upgradedQueue.claim(policy);
      expect(lease).toMatchObject({ jobId: id, attempt: 1 });
      if (!lease) throw new Error("expected a lease");

      await expect(
        upgradedQueue.succeed(lease, { reference: "mock:upgraded" }),
      ).resolves.toBe(true);
      const { rows: completed } = await pool.query(
        "select status, provider_reference from generation_jobs where id = $1",
        [id],
      );
      expect(completed).toEqual([
        { status: "succeeded", provider_reference: "mock:upgraded" },
      ]);
    } finally {
      await upgraded.close();
      await pool.end();
      await rm(migrationsWindow, { recursive: true, force: true });
      await database.pool.query("drop database loop_002_upgrade");
    }
  });

  it("claims a queued job with a fencing token and an attempt", async () => {
    const id = await insertQueuedJob();

    const lease = await queue.claim(policy);

    expect(lease).toMatchObject({ jobId: id, attempt: 1, provider: "mock" });
    expect(await readJob(id)).toMatchObject({
      status: "processing",
      attempt_count: 1,
    });
    await expect(queue.claim(policy)).resolves.toBeUndefined();
  });

  it("gives one active lease to two concurrent claimers", async () => {
    const id = await insertQueuedJob();
    const rival = new DatabaseService(container.getConnectionUri());

    try {
      const rivalQueue = new PostgresGenerationJobQueue(rival);
      const [first, second] = await Promise.all([
        queue.claim(policy),
        rivalQueue.claim(policy),
      ]);
      const leases = [first, second].filter(
        (lease): lease is GenerationJobLease => lease !== undefined,
      );

      expect(leases).toHaveLength(1);
      expect(leases[0]?.jobId).toBe(id);
      expect(await readJob(id)).toMatchObject({
        status: "processing",
        attempt_count: 1,
      });
    } finally {
      await rival.close();
    }
  });

  it("applies a result only for the current unexpired lease", async () => {
    const id = await insertQueuedJob();
    const lease = await queue.claim(policy);
    if (!lease) throw new Error("expected a lease");

    await expect(
      queue.succeed(
        { ...lease, fencingToken: crypto.randomUUID() },
        { reference: "provider:foreign-token" },
      ),
    ).resolves.toBe(false);
    expect(await readJob(id)).toMatchObject({ status: "processing" });

    await expireLease(id);
    await expect(
      queue.succeed(lease, { reference: "provider:expired" }),
    ).resolves.toBe(false);
    expect(await readJob(id)).toMatchObject({ status: "processing" });
  });

  it("rejects a result for a job that is not processing", async () => {
    const id = await insertQueuedJob();
    const queuedLease: GenerationJobLease = {
      jobId: id,
      prompt: "A cinematic sunrise over Seoul",
      provider: "mock",
      status: "processing",
      attempt: 1,
      fencingToken: crypto.randomUUID(),
    };

    const result = { reference: "provider:should-not-apply" };

    await expect(queue.succeed(queuedLease, result)).resolves.toBe(false);
    await expect(queue.fail(queuedLease, { reason: "x" })).resolves.toBe(false);
    expect(await readJob(id)).toMatchObject({
      status: "queued",
      attempt_count: 0,
    });
  });

  it("requeues a retryable failure behind its backoff and fails the third attempt", async () => {
    const id = await insertQueuedJob();
    const worker = new GenerationJobWorker(queue, {
      async generate() {
        throw new TransientProviderError("provider is warming up");
      },
    });

    const beforeRetry = await transactionTime();
    await expect(worker.runOnce()).resolves.toBe("retrying");
    await expect(queue.claim(policy)).resolves.toBeUndefined();

    const requeued = await readJob(id);
    expect(requeued).toMatchObject({
      status: "queued",
      attempt_count: 1,
      failure_reason: "provider is warming up",
    });
    expect(
      requeued.available_at.getTime() - beforeRetry.getTime(),
    ).toBeGreaterThanOrEqual(1_000);

    await database.pool.query(
      "update generation_jobs set available_at = now() where id = $1",
      [id],
    );
    const beforeSecondRetry = await transactionTime();
    await expect(worker.runOnce()).resolves.toBe("retrying");

    const requeuedAgain = await readJob(id);
    expect(requeuedAgain).toMatchObject({ status: "queued", attempt_count: 2 });
    expect(
      requeuedAgain.available_at.getTime() - beforeSecondRetry.getTime(),
    ).toBeGreaterThanOrEqual(2_000);

    await database.pool.query(
      "update generation_jobs set available_at = now() where id = $1",
      [id],
    );
    await expect(worker.runOnce()).resolves.toBe("failed");
    expect(await readJob(id)).toMatchObject({
      status: "failed",
      attempt_count: 3,
    });
    await expect(queue.claim(policy)).resolves.toBeUndefined();
  });

  it("fails a permanent failure on the first attempt", async () => {
    const id = await insertQueuedJob();
    const worker = new GenerationJobWorker(queue, {
      async generate() {
        throw new PermanentProviderError("prompt is rejected");
      },
    });

    await expect(worker.runOnce()).resolves.toBe("failed");
    expect(await readJob(id)).toMatchObject({
      status: "failed",
      attempt_count: 1,
      failure_reason: "prompt is rejected",
    });
  });

  it("requeues stale work below the attempt limit and fails an expired final attempt", async () => {
    const requeued = await insertQueuedJob("stale below the limit");
    await queue.claim(policy);
    await expireLease(requeued);

    await expect(queue.recoverExpiredLeases(policy)).resolves.toEqual({
      requeued: 1,
      failed: 0,
    });
    expect(await readJob(requeued)).toMatchObject({
      status: "queued",
      attempt_count: 1,
      fencing_token: null,
      lease_expires_at: null,
    });

    const exhausted = await insertQueuedJob("stale on the final attempt");
    await database.pool.query(
      "update generation_jobs set status = 'processing', attempt_count = 3, fencing_token = gen_random_uuid(), lease_expires_at = now() - interval '1 second' where id = $1",
      [exhausted],
    );

    await expect(queue.recoverExpiredLeases(policy)).resolves.toMatchObject({
      failed: 1,
    });
    expect(await readJob(exhausted)).toMatchObject({
      status: "failed",
      attempt_count: 3,
      failure_reason: "lease expired on the final attempt",
    });
  });

  describe("through the HTTP provider", () => {
    let local: LocalProvider;
    let worker: GenerationJobWorker;

    beforeAll(async () => {
      local = await startLocalProvider();
      worker = new GenerationJobWorker(
        queue,
        new HttpGenerationProvider({ baseUrl: local.url, timeoutMs: 500 }),
      );
    });

    afterAll(async () => {
      await local.close();
    });

    it("persists the normalized reference of a successful generation", async () => {
      const id = await insertQueuedJob("A cinematic sunrise over Seoul");

      await expect(worker.runOnce()).resolves.toBe("succeeded");

      const job = await readJob(id);
      expect(job.status).toBe("succeeded");
      expect(job.provider_reference).toMatch(/^http:[0-9a-f]{16}$/);
      expect(local.executions(id)).toBe(1);
    });

    it("retries a transient provider failure and ends a permanent one", async () => {
      const transient = await insertQueuedJob(
        "a prompt the provider finds unavailable",
      );

      await expect(worker.runOnce()).resolves.toBe("retrying");
      expect(await readJob(transient)).toMatchObject({
        status: "queued",
        attempt_count: 1,
        failure_reason: "provider 503: provider is unavailable",
        provider_reference: null,
      });

      await database.pool.query("truncate table generation_jobs");
      const permanent = await insertQueuedJob(
        "a prompt the provider finds anonymous",
      );

      await expect(worker.runOnce()).resolves.toBe("failed");
      expect(await readJob(permanent)).toMatchObject({
        status: "failed",
        attempt_count: 1,
        provider_reference: null,
      });
    });
  });

  it("resumes stale work after the worker is recreated without applying a result twice", async () => {
    const id = await insertQueuedJob();
    const abandoned = await queue.claim(policy);
    if (!abandoned) throw new Error("expected a lease");
    await expireLease(id);

    const restarted = new DatabaseService(container.getConnectionUri());
    try {
      const restartedWorker = new GenerationJobWorker(
        new PostgresGenerationJobQueue(restarted),
        mockGenerationProvider,
      );

      await expect(restartedWorker.runOnce()).resolves.toBe("succeeded");
      expect(await readJob(id)).toMatchObject({
        status: "succeeded",
        attempt_count: 2,
      });

      await expect(
        queue.succeed(abandoned, { reference: "provider:stale" }),
      ).resolves.toBe(false);
      expect(await readJob(id)).toMatchObject({
        status: "succeeded",
        attempt_count: 2,
      });
    } finally {
      await restarted.close();
    }
  });
});
