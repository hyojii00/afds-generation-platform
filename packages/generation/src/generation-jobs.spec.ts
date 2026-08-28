import { describe, expect, it } from "vitest";
import {
  GenerationJobNotFoundError,
  GenerationJobs,
  InMemoryGenerationJobRepository,
} from "./index.js";

describe("GenerationJobs", () => {
  it("creates and retrieves a queued job", async () => {
    const jobs = new GenerationJobs(new InMemoryGenerationJobRepository());

    const created = await jobs.create({
      prompt: "A cinematic sunrise over Seoul",
      provider: "mock",
    });

    expect(created).toMatchObject({
      prompt: "A cinematic sunrise over Seoul",
      provider: "mock",
      status: "queued",
    });
    expect(created.id).not.toHaveLength(0);
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
    await expect(jobs.get(created.id)).resolves.toEqual(created);
  });

  it("reports an unknown job", async () => {
    const jobs = new GenerationJobs(new InMemoryGenerationJobRepository());

    await expect(jobs.get("missing")).rejects.toBeInstanceOf(
      GenerationJobNotFoundError,
    );
  });
});
