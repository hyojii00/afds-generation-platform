import type { GenerationProvider } from "./generation-jobs.js";
import type {
  GenerationProviderPort,
  ProviderNotice,
  ProviderOutcome,
  ProviderResult,
} from "./generation-provider.js";
import { assertTransition, type GenerationJobStatus } from "./job-lifecycle.js";

export type GenerationJobLease = Readonly<{
  jobId: string;
  prompt: string;
  provider: GenerationProvider;
  /** The status the claim persisted, as the database returned it. */
  status: GenerationJobStatus;
  attempt: number;
  fencingToken: string;
  /** Secret the provider must present to report this attempt's outcome. */
  callbackToken: string;
}>;

export type ExecutionPolicy = Readonly<{
  maxAttempts: number;
  retryBackoffSeconds: readonly number[];
  leaseSeconds: number;
  /** How long a provider may take to report work it accepted. */
  awaitSeconds: number;
}>;

export const defaultExecutionPolicy: ExecutionPolicy = {
  maxAttempts: 3,
  retryBackoffSeconds: [1, 2],
  leaseSeconds: 30,
  awaitSeconds: 60,
};

/**
 * Seconds to wait before the failed attempt becomes claimable again, or
 * undefined when the attempt limit leaves no retry. Attempts beyond the
 * configured backoffs reuse the last one, so a shorter list never turns a
 * retryable failure into a terminal one.
 */
export function retryDelaySeconds(
  policy: ExecutionPolicy,
  failedAttempt: number,
): number | undefined {
  if (failedAttempt >= policy.maxAttempts) {
    return undefined;
  }

  const backoffs = policy.retryBackoffSeconds;
  return backoffs[Math.min(failedAttempt, backoffs.length) - 1];
}

/** A failure that another attempt may resolve, within the attempt limit. */
export class RetryableGenerationError extends Error {}

export interface GenerationJobQueue {
  claim(input: {
    leaseSeconds: number;
    maxAttempts: number;
  }): Promise<GenerationJobLease | undefined>;
  /** Each result method returns false when the lease no longer owns the job. */
  succeed(lease: GenerationJobLease, result: ProviderResult): Promise<boolean>;
  retry(
    lease: GenerationJobLease,
    input: { availableInSeconds: number; reason: string },
  ): Promise<boolean>;
  fail(lease: GenerationJobLease, input: { reason: string }): Promise<boolean>;
  /** Releases the lease and waits for the provider's completion notice. */
  awaitProvider(
    lease: GenerationJobLease,
    input: { reference: string; deadlineSeconds: number },
  ): Promise<boolean>;
  /** Applies a notice to the job the token identifies, once. */
  applyProviderNotice(
    jobId: string,
    callbackTokenHash: string,
    notice: ProviderNotice,
  ): Promise<boolean>;
  recoverExpiredLeases(input: {
    maxAttempts: number;
  }): Promise<{ requeued: number; failed: number }>;
  /** Recovers waits whose deadline passed, inside the attempt budget. */
  recoverExpiredWaits(input: {
    maxAttempts: number;
    retryBackoffSeconds: readonly number[];
  }): Promise<{ requeued: number; failed: number }>;
}

export type GenerationJobOutcome =
  | "idle"
  | "awaiting"
  | "succeeded"
  | "retrying"
  | "failed"
  | "lost";

export class GenerationJobWorker {
  constructor(
    private readonly queue: GenerationJobQueue,
    private readonly provider: GenerationProviderPort,
    private readonly policy: ExecutionPolicy = defaultExecutionPolicy,
  ) {}

  async runOnce(): Promise<GenerationJobOutcome> {
    await this.queue.recoverExpiredLeases({
      maxAttempts: this.policy.maxAttempts,
    });
    await this.queue.recoverExpiredWaits({
      maxAttempts: this.policy.maxAttempts,
      retryBackoffSeconds: this.policy.retryBackoffSeconds,
    });

    const lease = await this.queue.claim({
      leaseSeconds: this.policy.leaseSeconds,
      maxAttempts: this.policy.maxAttempts,
    });

    if (!lease) {
      return "idle";
    }

    let outcome: ProviderOutcome;

    try {
      outcome = await this.provider.generate({
        jobId: lease.jobId,
        prompt: lease.prompt,
        provider: lease.provider,
        callbackToken: lease.callbackToken,
      });
    } catch (error) {
      return await this.applyFailure(lease, error);
    }

    if (outcome.status === "accepted") {
      assertTransition(lease.status, "awaiting_provider");
      const parked = await this.queue.awaitProvider(lease, {
        reference: outcome.reference,
        deadlineSeconds: this.policy.awaitSeconds,
      });

      return parked ? "awaiting" : "lost";
    }

    assertTransition(lease.status, "succeeded");
    return (await this.queue.succeed(lease, outcome)) ? "succeeded" : "lost";
  }

  private async applyFailure(
    lease: GenerationJobLease,
    error: unknown,
  ): Promise<GenerationJobOutcome> {
    const reason = error instanceof Error ? error.message : String(error);
    const availableInSeconds =
      error instanceof RetryableGenerationError
        ? retryDelaySeconds(this.policy, lease.attempt)
        : undefined;

    if (availableInSeconds === undefined) {
      assertTransition(lease.status, "failed");
      return (await this.queue.fail(lease, { reason })) ? "failed" : "lost";
    }

    assertTransition(lease.status, "queued");
    return (await this.queue.retry(lease, { availableInSeconds, reason }))
      ? "retrying"
      : "lost";
  }
}
