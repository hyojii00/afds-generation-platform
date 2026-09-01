import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { DatabaseService } from "../src/database/database.service.js";
import {
  migrateDatabase,
  startPostgres,
} from "../../../tests/support/postgres.js";

describe("runtime health", () => {
  let container: StartedPostgreSqlContainer;
  let databaseUrl: string;

  beforeAll(async () => {
    container = await startPostgres();
    databaseUrl = container.getConnectionUri();
    await migrateDatabase(databaseUrl);
  });

  afterAll(async () => {
    await container.stop();
  });

  async function createApp() {
    process.env.DATABASE_URL = databaseUrl;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: { level: "silent" } }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
  }

  it("reports a servable process", async () => {
    const app = await createApp();

    try {
      const response = await request(app.getHttpServer())
        .get("/health")
        .expect(200);

      expect(response.body).toEqual({ status: "ok" });
    } finally {
      await app.close();
    }
  });

  it("reports an unusable database without revealing it", async () => {
    const app = await createApp();

    try {
      await app.get(DatabaseService).close();

      const response = await request(app.getHttpServer())
        .get("/health")
        .expect(503);

      expect(response.body).toEqual({ status: "unavailable" });
      expect(JSON.stringify(response.body)).not.toContain(databaseUrl);
      expect(JSON.stringify(response.body)).not.toContain("pool");
    } finally {
      await app.close();
    }
  });

  it("leaves the product API untouched", async () => {
    const app = await createApp();

    try {
      await request(app.getHttpServer()).get("/v1/jobs/missing").expect(404);
      await request(app.getHttpServer())
        .post("/v1/jobs")
        .send({ prompt: "A cinematic sunrise over Seoul", provider: "mock" })
        .expect(201);
      await request(app.getHttpServer()).get("/v1/health").expect(404);
    } finally {
      await app.close();
    }
  });
});
