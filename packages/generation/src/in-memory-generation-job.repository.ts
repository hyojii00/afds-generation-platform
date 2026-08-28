import type {
  GenerationJob,
  GenerationJobRepository,
} from "./generation-jobs.js";

export class InMemoryGenerationJobRepository
  implements GenerationJobRepository
{
  private readonly jobs = new Map<string, GenerationJob>();

  async save(job: GenerationJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async findById(id: string): Promise<GenerationJob | undefined> {
    return this.jobs.get(id);
  }
}
