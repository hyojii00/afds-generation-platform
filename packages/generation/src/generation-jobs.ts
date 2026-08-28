import { randomUUID } from "node:crypto";
import type { GenerationJob, GenerationProvider } from "./generation-job.js";
import type { GenerationJobRepository } from "./generation-job.repository.js";

export class GenerationJobNotFoundError extends Error {}

export class GenerationJobs {
  constructor(private readonly repository: GenerationJobRepository) {}

  async create(input: {
    prompt: string;
    provider: GenerationProvider;
  }): Promise<GenerationJob> {
    const job: GenerationJob = {
      id: randomUUID(),
      prompt: input.prompt,
      provider: input.provider,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    await this.repository.save(job);
    return job;
  }

  async get(id: string): Promise<GenerationJob> {
    const job = await this.repository.findById(id);

    if (!job) {
      throw new GenerationJobNotFoundError(
        `Generation job ${id} was not found`,
      );
    }

    return job;
  }
}
