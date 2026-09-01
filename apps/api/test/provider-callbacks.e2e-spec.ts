import {
  defaultExecutionPolicy,
  GenerationJobWorker,
} from "@afds-generation-platform/generation";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { DatabaseService } from "../src/database/database.service.js";
import { PostgresGenerationJobQueue } from "../src/database/postgres-generation-job.queue.js";
import { HttpGenerationProvider } from "../src/providers/http-generation.provider.js";
import {
  type LocalProvider,
  startLocalProvider,
} from "../../../tests/support/local-provider.js";
import {
  migrateDatabase,
  startPostgres,
} from "../../../tests/support/postgres.js";

describe("provider completion callbacks", () => {
  let container: StartedPostgreSqlContainer;
  let databaseUrl: string;
  let app: NestFastifyApplication;
  let apiUrl: string;
  let local: LocalProvider;
  let database: DatabaseService;
  let worker: GenerationJobWorker;

  beforeAll(async () => {
    container = await startPostgres();
    databaseUrl = container.getConnectionUri();
    await migrateDatabase(databaseUrl);
    process.env.DATABASE_URL = databaseUrl;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.listen({ host: "127.0.0.1", port: 0 });
    apiUrl = await app.getUrl();

    local = await startLocalProvider();
    database = new DatabaseService(databaseUrl);
    worker = new GenerationJobWorker(
      new PostgresGenerationJobQueue(database),
      new HttpGenerationProvider({
        baseUrl: local.url,
        timeoutMs: 500,
        callbackBaseUrl: apiUrl,
      }),
    );
  });

  afterAll(async () => {
    await database.close();
    await local.close();
    await app.close();
    await container.stop();
  });

  beforeEach(async () => {
    await database.pool.query("truncate table generation_jobs");
  });

  async function createJob(prompt: string) {
    const created = await request(apiUrl)
      .post("/v1/jobs")
      .send({ prompt, provider: "mock" })
      .expect(201);

    return created.body as { id: string; status: string };
  }

  async function readStatus(id: string) {
    const retrieved = await request(apiUrl).get(`/v1/jobs/${id}`).expect(200);
    return retrieved.body as Record<string, unknown>;
  }

  it("completes an asynchronous generation through a provider notice", async () => {
    const created = await createJob("An asynchronous cinematic sunrise");

    await expect(worker.runOnce()).resolves.toBe("awaiting");

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const job = await readStatus(created.id);
      if (job.status === "succeeded") {
        expect(job).toEqual({ ...created, status: "succeeded" });
        expect(local.notices()).toEqual([
          {
            url: expect.stringContaining(
              `/v1/provider-callbacks/${created.id}/`,
            ),
            status: 204,
          },
        ]);
        return;
      }

      await delay(50);
    }

    throw new Error("the provider notice never settled the job");
  });

  it("reports work waiting for a provider as processing", async () => {
    const created = await createJob("A silent asynchronous sunrise");

    await expect(worker.runOnce()).resolves.toBe("awaiting");

    expect(await readStatus(created.id)).toEqual({
      ...created,
      status: "processing",
    });
  });

  it("carries a provider failure notice into a failed job", async () => {
    const created = await createJob(
      "An asynchronous prompt the provider rejects",
    );

    await expect(worker.runOnce()).resolves.toBe("awaiting");

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const job = await readStatus(created.id);
      if (job.status === "failed") {
        return;
      }

      await delay(50);
    }

    throw new Error("the provider failure notice never settled the job");
  });

  it("answers an unauthorized or unknown notice the same way", async () => {
    const created = await createJob("A silent asynchronous sunrise");
    await expect(worker.runOnce()).resolves.toBe("awaiting");

    await request(apiUrl)
      .post(`/v1/provider-callbacks/${created.id}/${randomUUID()}`)
      .send({ status: "succeeded" })
      .expect(404);
    await request(apiUrl)
      .post(`/v1/provider-callbacks/${randomUUID()}/${randomUUID()}`)
      .send({ status: "succeeded" })
      .expect(404);

    expect(await readStatus(created.id)).toMatchObject({
      status: "processing",
    });
  });

  it("rejects a notice without a usable status", async () => {
    const created = await createJob("A silent asynchronous sunrise");
    await expect(worker.runOnce()).resolves.toBe("awaiting");

    await request(apiUrl)
      .post(`/v1/provider-callbacks/${created.id}/${randomUUID()}`)
      .send({ status: "unknown" })
      .expect(400);
  });
});
