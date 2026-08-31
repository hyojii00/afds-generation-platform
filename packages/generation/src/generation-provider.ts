import type { GenerationProvider } from "./generation-jobs.js";
import { RetryableGenerationError } from "./generation-job-worker.js";

export type ProviderRequest = Readonly<{
  /** Also the idempotency key: one job identifies one unit of provider work. */
  jobId: string;
  prompt: string;
  provider: GenerationProvider;
}>;

/** The only provider output the platform keeps: a normalized reference. */
export type ProviderResult = Readonly<{ reference: string }>;

export interface GenerationProviderPort {
  generate(request: ProviderRequest): Promise<ProviderResult>;
}

/**
 * A failure another attempt may resolve. Extends the retryable error the
 * worker already classifies, so only transient provider failures reach the
 * retry path.
 */
export class TransientProviderError extends RetryableGenerationError {
  constructor(
    reason: string,
    readonly status?: number,
  ) {
    super(status === undefined ? reason : `provider ${status}: ${reason}`);
  }
}

/** A failure no attempt will resolve. */
export class PermanentProviderError extends Error {
  constructor(
    reason: string,
    readonly status?: number,
  ) {
    super(status === undefined ? reason : `provider ${status}: ${reason}`);
  }
}
