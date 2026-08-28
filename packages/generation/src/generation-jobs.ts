import { randomUUID } from "node:crypto";

export type GenerationProvider = "mock";

export type GenerationJob = Readonly<{
  id: string;
  prompt: string;
  provider: GenerationProvider;
  status: "queued";
  createdAt: string;
}>;

export interface GenerationJobRepository {
  save(job: GenerationJob): Promise<void>;
  findById(id: string): Promise<GenerationJob | undefined>;
}

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
