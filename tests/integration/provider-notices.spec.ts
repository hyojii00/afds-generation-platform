import {
  defaultExecutionPolicy,
  type GenerationJobLease,
  type GenerationProviderPort,
  GenerationJobWorker,
} from "@afds-generation-platform/generation";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseService } from "../../apps/api/src/database/database.service.js";
import { PostgresGenerationJobQueue } from "../../apps/api/src/database/postgres-generation-job.queue.js";
import { hashCallbackToken } from "../../apps/api/src/providers/callback-token.js";
import { migrateDatabase, startPostgres } from "../support/postgres.js";

const acceptingProvider: GenerationProviderPort = {
  async generate(request) {
    return { status: "accepted", reference: `http:${request.jobId}` };
  },
};

describe("provider completion notices", () => {
  let container: StartedPostgreSqlContainer;
  let database: DatabaseService;
  let queue: PostgresGenerationJobQueue;
  let worker: GenerationJobWorker;

  beforeAll(async () => {
    container = await startPostgres();
    await migrateDatabase(container.getConnectionUri());
    database = new DatabaseService(container.getConnectionUri());
    await database.assertReady();
    queue = new PostgresGenerationJobQueue(database);
    worker = new GenerationJobWorker(queue, acceptingProvider);
  });

  afterAll(async () => {
    await database.close();
    await container.stop();
  });

  beforeEach(async () => {
    await database.pool.query("truncate table generation_jobs");
  });

  async function insertQueuedJob(prompt = "An asynchronous cinematic sunrise") {
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
      fencing_token: string | null;
      lease_expires_at: Date | null;
      awaiting_deadline: Date | null;
      callback_token_hash: string | null;
      provider_reference: string | null;
      failure_reason: string | null;
      available_at: Date;
    }>("select * from generation_jobs where id = $1", [id]);

    const [row] = rows;
    if (!row) {
      throw new Error(`expected generation job ${id}`);
    }

    return row;
  }

  async function claimAndPark(prompt?: string) {
    const id = await insertQueuedJob(prompt);
    const lease = await queue.claim(defaultExecutionPolicy);
    if (!lease) {
      throw new Error("expected a lease");
    }

    await expect(
      queue.awaitProvider(lease, {
        reference: `http:${id}`,
        deadlineSeconds: defaultExecutionPolicy.awaitSeconds,
      }),
    ).resolves.toBe(true);

    return { id, lease };
  }

  async function expireWait(id: string) {
    await database.pool.query(
      "update generation_jobs set awaiting_deadline = now() - interval '1 second' where id = $1",
      [id],
    );
  }

  it("parks accepted work, releases the lease, and keeps the attempt", async () => {
    const id = await insertQueuedJob();

    await expect(worker.runOnce()).resolves.toBe("awaiting");

    const job = await readJob(id);
    expect(job).toMatchObject({
      status: "awaiting_provider",
      attempt_count: 1,
      fencing_token: null,
      lease_expires_at: null,
      provider_reference: `http:${id}`,
    });
    expect(job.awaiting_deadline?.getTime()).toBeGreaterThan(Date.now());
    await expect(queue.claim(defaultExecutionPolicy)).resolves.toBeUndefined();
  });

  it("stores only the hash of the attempt's callback token", async () => {
    const { id, lease } = await claimAndPark();

    const job = await readJob(id);
    expect(job.callback_token_hash).toBe(
      hashCallbackToken(lease.callbackToken),
    );
    expect(JSON.stringify(job)).not.toContain(lease.callbackToken);
  });

  it("applies a notice once and ignores the second delivery", async () => {
    const { id, lease } = await claimAndPark();
    const hash = hashCallbackToken(lease.callbackToken);

    await expect(
      queue.applyProviderNotice(id, hash, {
        status: "succeeded",
        reference: "http:final",
      }),
    ).resolves.toBe(true);
    expect(await readJob(id)).toMatchObject({
      status: "succeeded",
      provider_reference: "http:final",
      callback_token_hash: null,
      awaiting_deadline: null,
      attempt_count: 1,
    });

    await expect(
      queue.applyProviderNotice(id, hash, {
        status: "failed",
        reason: "a late contradiction",
      }),
    ).resolves.toBe(false);
    expect(await readJob(id)).toMatchObject({
      status: "succeeded",
      failure_reason: null,
    });
  });

  it("records a failure notice with its reason", async () => {
    const { id, lease } = await claimAndPark();

    await expect(
      queue.applyProviderNotice(id, hashCallbackToken(lease.callbackToken), {
        status: "failed",
        reason: "provider could not render the prompt",
      }),
    ).resolves.toBe(true);
    expect(await readJob(id)).toMatchObject({
      status: "failed",
      failure_reason: "provider could not render the prompt",
    });
  });

  it("rejects a notice that does not own the current wait", async () => {
    const { id, lease } = await claimAndPark();
    const hash = hashCallbackToken(lease.callbackToken);

    await expect(
      queue.applyProviderNotice(id, hashCallbackToken(randomUUID()), {
        status: "succeeded",
      }),
    ).resolves.toBe(false);
    await expect(
      queue.applyProviderNotice(randomUUID(), hash, { status: "succeeded" }),
    ).resolves.toBe(false);
    await expect(
      queue.applyProviderNotice("not-a-job", hash, { status: "succeeded" }),
    ).resolves.toBe(false);
    expect(await readJob(id)).toMatchObject({ status: "awaiting_provider" });

    await expireWait(id);
    await expect(
      queue.applyProviderNotice(id, hash, { status: "succeeded" }),
    ).resolves.toBe(false);
    expect(await readJob(id)).toMatchObject({ status: "awaiting_provider" });
  });

  it("rejects a notice for a job that is not awaiting a provider", async () => {
    const id = await insertQueuedJob();
    const lease = await queue.claim(defaultExecutionPolicy);
    if (!lease) {
      throw new Error("expected a lease");
    }

    await expect(
      queue.applyProviderNotice(id, hashCallbackToken(lease.callbackToken), {
        status: "succeeded",
      }),
    ).resolves.toBe(false);
    expect(await readJob(id)).toMatchObject({ status: "processing" });
  });

  it("issues a new callback token for every attempt", async () => {
    const { id, lease } = await claimAndPark();
    const stale = hashCallbackToken(lease.callbackToken);

    await expireWait(id);
    await expect(
      queue.recoverExpiredWaits(defaultExecutionPolicy),
    ).resolves.toMatchObject({ requeued: 1 });
    await database.pool.query(
      "update generation_jobs set available_at = now() where id = $1",
      [id],
    );

    const reclaimed = await queue.claim(defaultExecutionPolicy);
    if (!reclaimed) {
      throw new Error("expected a second lease");
    }
    expect(reclaimed.callbackToken).not.toBe(lease.callbackToken);
    await queue.awaitProvider(reclaimed, {
      reference: `http:${id}`,
      deadlineSeconds: defaultExecutionPolicy.awaitSeconds,
    });

    await expect(
      queue.applyProviderNotice(id, stale, { status: "succeeded" }),
    ).resolves.toBe(false);
    await expect(
      queue.applyProviderNotice(
        id,
        hashCallbackToken(reclaimed.callbackToken),
        {
          status: "succeeded",
        },
      ),
    ).resolves.toBe(true);
  });

  it("recovers a missed notice inside the attempt budget", async () => {
    const { id } = await claimAndPark();
    await expireWait(id);

    const before = await database.pool.query<{ now: Date }>("select now()");
    await expect(
      queue.recoverExpiredWaits(defaultExecutionPolicy),
    ).resolves.toEqual({ requeued: 1, failed: 0 });

    const requeued = await readJob(id);
    expect(requeued).toMatchObject({
      status: "queued",
      attempt_count: 1,
      callback_token_hash: null,
      awaiting_deadline: null,
      failure_reason: "provider did not report a result",
    });
    expect(
      requeued.available_at.getTime() - (before.rows[0]?.now.getTime() ?? 0),
    ).toBeGreaterThanOrEqual(1_000);
  });

  it("fails a missed notice on the last attempt", async () => {
    const { id } = await claimAndPark();
    await database.pool.query(
      "update generation_jobs set attempt_count = 3, awaiting_deadline = now() - interval '1 second' where id = $1",
      [id],
    );

    await expect(
      queue.recoverExpiredWaits(defaultExecutionPolicy),
    ).resolves.toEqual({ requeued: 0, failed: 1 });
    expect(await readJob(id)).toMatchObject({
      status: "failed",
      failure_reason: "provider did not report a result",
    });
  });
});
