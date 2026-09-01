import type { GenerationProvider } from "./generation-jobs.js";
import { RetryableGenerationError } from "./generation-job-worker.js";

export type ProviderRequest = Readonly<{
  /** Also the idempotency key: one job identifies one unit of provider work. */
  jobId: string;
  prompt: string;
  provider: GenerationProvider;
  /** The attempt's callback secret, for a provider that answers later. */
  callbackToken: string;
}>;

/** The only provider output the platform keeps: a normalized reference. */
export type ProviderResult = Readonly<{ reference: string }>;

/**
 * `completed` carries the finished generation. `accepted` means the provider
 * took the work and will report the outcome through a completion notice.
 */
export type ProviderOutcome = Readonly<
  ProviderResult & { status: "completed" | "accepted" }
>;

/** What a completion notice can say about work the provider accepted. */
export type ProviderNotice = Readonly<
  | { status: "succeeded"; reference?: string }
  | { status: "failed"; reason: string }
>;

export interface GenerationProviderPort {
  generate(request: ProviderRequest): Promise<ProviderOutcome>;
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
