import { AppModule } from "../src/app.module.js";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("generation jobs API", () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("accepts and retrieves a mock-provider job", async () => {
    const created = await request(app.getHttpServer())
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

    const retrieved = await request(app.getHttpServer())
      .get(`/v1/jobs/${created.body.id}`)
      .expect(200);

    expect(retrieved.body).toEqual(created.body);
  });

  it("rejects invalid creation input", async () => {
    await request(app.getHttpServer())
      .post("/v1/jobs")
      .send({ prompt: "", provider: "mock" })
      .expect(400);
  });

  it("returns 404 for an unknown job", async () => {
    await request(app.getHttpServer()).get("/v1/jobs/missing").expect(404);
  });
});
