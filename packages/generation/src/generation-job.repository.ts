import type { GenerationJob } from "./generation-job.js";

export interface GenerationJobRepository {
  save(job: GenerationJob): Promise<void>;
  findById(id: string): Promise<GenerationJob | undefined>;
}
