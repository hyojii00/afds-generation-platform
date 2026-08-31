import {
  mockGenerationProvider,
  GenerationJobWorker,
} from "@afds-generation-platform/generation";
import { AppModule } from "../src/app.module.js";
import { DatabaseService } from "../src/database/database.service.js";
import { PostgresGenerationJobQueue } from "../src/database/postgres-generation-job.queue.js";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  migrateDatabase,
  startPostgres,
} from "../../../tests/support/postgres.js";

describe("generation jobs API", () => {
  let container: StartedPostgreSqlContainer;
  let databaseUrl: string;
  let adminPool: Pool;

  beforeAll(async () => {
    container = await startPostgres();
    databaseUrl = container.getConnectionUri();
    await migrateDatabase(databaseUrl);
    adminPool = new Pool({ connectionString: databaseUrl });
  });

  afterAll(async () => {
    await adminPool.end();
    await container.stop();
  });

  beforeEach(async () => {
    await adminPool.query("truncate table generation_jobs");
  });

  async function createApp(connectionString = databaseUrl) {
    process.env.DATABASE_URL = connectionString;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
  }

  it("retrieves the same job after the application restarts", async () => {
    const firstApp = await createApp();
    const created = await request(firstApp.getHttpServer())
      .post("/v1/jobs")
      .send({ prompt: "A cinematic sunrise over Seoul", provider: "mock" })
      .expect(201);

    expect(created.body).toMatchObject({
      prompt: "A cinematic sunrise over Seoul",
      provider: "mock",
      status: "queued",
    });
    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.createdAt).toEqual(expect.any(String));
    await firstApp.close();

    const restartedApp = await createApp();
    const retrieved = await request(restartedApp.getHttpServer())
      .get(`/v1/jobs/${created.body.id}`)
      .expect(200);

    expect(retrieved.body).toEqual(created.body);
    await restartedApp.close();
  });

  it("accepts a job as claimable work and reports its lifecycle status", async () => {
    const app = await createApp();

    try {
      await expectLifecycleStatus(app);
    } finally {
      await app.close();
    }
  });

  async function expectLifecycleStatus(app: NestFastifyApplication) {
    const created = await request(app.getHttpServer())
      .post("/v1/jobs")
      .send({ prompt: "A cinematic sunrise over Seoul", provider: "mock" })
      .expect(201);

    expect(created.body).toMatchObject({ status: "queued" });
    const claimable = await adminPool.query(
      "select 1 from generation_jobs where id = $1 and status = 'queued' and attempt_count = 0 and available_at <= now()",
      [created.body.id],
    );
    expect(claimable.rowCount).toBe(1);

    const database = new DatabaseService(databaseUrl);
    try {
      const worker = new GenerationJobWorker(
        new PostgresGenerationJobQueue(database),
        mockGenerationProvider,
      );
      await expect(worker.runOnce()).resolves.toBe("succeeded");
    } finally {
      await database.close();
    }

    const retrieved = await request(app.getHttpServer())
      .get(`/v1/jobs/${created.body.id}`)
      .expect(200);

    expect(retrieved.body).toEqual({ ...created.body, status: "succeeded" });
  }

  it("rejects invalid creation input", async () => {
    const app = await createApp();
    await request(app.getHttpServer())
      .post("/v1/jobs")
      .send({ prompt: "", provider: "mock" })
      .expect(400);
    await app.close();
  });

  it("returns 404 for an unknown job", async () => {
    const app = await createApp();
    await request(app.getHttpServer()).get("/v1/jobs/missing").expect(404);
    await app.close();
  });

  it("fails startup when PostgreSQL is unavailable", async () => {
    await expect(
      createApp("postgresql://afds:afds@127.0.0.1:1/unavailable"),
    ).rejects.toThrow();
  });
});
