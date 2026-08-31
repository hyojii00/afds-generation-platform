import type {
  GenerationJobExecutor,
  GenerationJobLease,
} from "./generation-job-worker.js";

/**
 * Deterministic, side-effect-free stand-in for a provider call. Loop 004 owns
 * real provider contracts and their external idempotency strategy.
 */
export const executeMockGeneration: GenerationJobExecutor = async (
  lease: GenerationJobLease,
) => {
  if (lease.provider !== "mock") {
    throw new Error(`Unsupported provider ${lease.provider}`);
  }

  if (lease.prompt.trim().length === 0) {
    throw new Error(`Generation job ${lease.jobId} has an empty prompt`);
  }
};
