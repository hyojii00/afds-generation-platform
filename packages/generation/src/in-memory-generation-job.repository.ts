import type { GenerationJob } from "./generation-job.js";
import type { GenerationJobRepository } from "./generation-job.repository.js";

export class InMemoryGenerationJobRepository
  implements GenerationJobRepository
{
  readonly jobs = new Map<string, GenerationJob>();

  async save(job: GenerationJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async findById(id: string): Promise<GenerationJob | undefined> {
    return this.jobs.get(id);
  }
}
