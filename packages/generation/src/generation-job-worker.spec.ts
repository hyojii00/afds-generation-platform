import { describe, expect, it } from "vitest";
import {
  defaultExecutionPolicy,
  InvalidGenerationJobTransitionError,
  mockGenerationProvider,
  type GenerationJobLease,
  type GenerationJobQueue,
  GenerationJobWorker,
  type GenerationProviderPort,
  PermanentProviderError,
  retryDelaySeconds,
  type SettledGenerationJob,
  TransientProviderError,
} from "./index.js";

type RecordedCall =
  | { kind: "recover"; maxAttempts: number }
  | { kind: "recover-waits"; maxAttempts: number }
  | { kind: "claim"; leaseSeconds: number; maxAttempts: number }
  | { kind: "succeed"; reference: string }
  | { kind: "await"; reference: string; deadlineSeconds: number }
  | { kind: "retry"; availableInSeconds: number; reason: string }
  | { kind: "fail"; reason: string };

class RecordingQueue implements GenerationJobQueue {
  readonly calls: RecordedCall[] = [];

  constructor(
    private readonly lease: GenerationJobLease | undefined,
    private readonly applied = true,
  ) {}

  async claim(input: { leaseSeconds: number; maxAttempts: number }) {
    this.calls.push({ kind: "claim", ...input });
    return this.lease;
  }

  async succeed(_lease: GenerationJobLease, result: { reference: string }) {
    this.calls.push({ kind: "succeed", reference: result.reference });
    return this.applied;
  }

  async retry(
    _lease: GenerationJobLease,
    input: { availableInSeconds: number; reason: string },
  ) {
    this.calls.push({ kind: "retry", ...input });
    return this.applied;
  }

  async fail(_lease: GenerationJobLease, input: { reason: string }) {
    this.calls.push({ kind: "fail", ...input });
    return this.applied;
  }

  async recoverExpiredLeases(input: { maxAttempts: number }) {
    this.calls.push({ kind: "recover", ...input });
    return { requeued: 0, failed: 0 };
  }

  async recoverExpiredWaits(input: { maxAttempts: number }) {
    this.calls.push({ kind: "recover-waits", maxAttempts: input.maxAttempts });
    return { requeued: 0, failed: 0 };
  }

  async awaitProvider(
    _lease: GenerationJobLease,
    input: { reference: string; deadlineSeconds: number },
  ) {
    this.calls.push({ kind: "await", ...input });
    return this.applied;
  }

  async applyProviderNotice() {
    return this.applied;
  }
}

function failingProvider(error: Error): GenerationProviderPort {
  return {
    async generate() {
      throw error;
    },
  };
}

function leaseFor(attempt: number): GenerationJobLease {
  return {
    jobId: "6430a8ca-6c92-4cc3-81f9-4f6ee93db23f",
    prompt: "A cinematic sunrise over Seoul",
    provider: "mock",
    status: "processing",
    attempt,
    fencingToken: "0c2a1f16-3d0c-4a5e-9f16-6a29f1d1b0f5",
    callbackToken: "f2ec1f0b-9a1a-4c53-90f4-2b1c6a2b7c11",
  };
}

describe("retryDelaySeconds", () => {
  it("backs off once and twice before the attempt limit", () => {
    expect(retryDelaySeconds(defaultExecutionPolicy, 1)).toBe(1);
    expect(retryDelaySeconds(defaultExecutionPolicy, 2)).toBe(2);
  });

  it("leaves no retry for the last attempt", () => {
    expect(retryDelaySeconds(defaultExecutionPolicy, 3)).toBeUndefined();
    expect(retryDelaySeconds(defaultExecutionPolicy, 4)).toBeUndefined();
  });
});

describe("GenerationJobWorker", () => {
  it("recovers expired leases before claiming and reports an empty queue", async () => {
    const queue = new RecordingQueue(undefined);

    await expect(
      new GenerationJobWorker(queue, mockGenerationProvider).runOnce(),
    ).resolves.toBe("idle");
    expect(queue.calls).toEqual([
      { kind: "recover", maxAttempts: 3 },
      { kind: "recover-waits", maxAttempts: 3 },
      { kind: "claim", leaseSeconds: 30, maxAttempts: 3 },
    ]);
  });

  it("succeeds on the deterministic mock execution", async () => {
    const queue = new RecordingQueue(leaseFor(1));

    await expect(
      new GenerationJobWorker(queue, mockGenerationProvider).runOnce(),
    ).resolves.toBe("succeeded");
    expect(queue.calls.at(-1)).toEqual({
      kind: "succeed",
      reference: "mock:6430a8ca-6c92-4cc3-81f9-4f6ee93db23f",
    });
  });

  it.each([
    [1, 1],
    [2, 2],
  ])(
    "requeues retryable attempt %i after %i second(s)",
    async (attempt, backoff) => {
      const queue = new RecordingQueue(leaseFor(attempt));
      const worker = new GenerationJobWorker(
        queue,
        failingProvider(new TransientProviderError("provider is warming up")),
      );

      await expect(worker.runOnce()).resolves.toBe("retrying");
      expect(queue.calls.at(-1)).toEqual({
        kind: "retry",
        availableInSeconds: backoff,
        reason: "provider is warming up",
      });
    },
  );

  it("fails the third retryable attempt", async () => {
    const queue = new RecordingQueue(leaseFor(3));
    const worker = new GenerationJobWorker(
      queue,
      failingProvider(new TransientProviderError("provider is warming up")),
    );

    await expect(worker.runOnce()).resolves.toBe("failed");
    expect(queue.calls.at(-1)).toEqual({
      kind: "fail",
      reason: "provider is warming up",
    });
  });

  it("fails a permanent failure on the first attempt", async () => {
    const queue = new RecordingQueue(leaseFor(1));
    const worker = new GenerationJobWorker(
      queue,
      failingProvider(new PermanentProviderError("prompt is rejected")),
    );

    await expect(worker.runOnce()).resolves.toBe("failed");
    expect(queue.calls.at(-1)).toEqual({
      kind: "fail",
      reason: "prompt is rejected",
    });
  });

  it("reuses the last backoff when the policy configures fewer than it allows", () => {
    expect(
      retryDelaySeconds(
        {
          maxAttempts: 5,
          retryBackoffSeconds: [1, 2],
          leaseSeconds: 30,
          awaitSeconds: 60,
        },
        3,
      ),
    ).toBe(2);
  });

  it("refuses to settle a lease that is not processing", async () => {
    const queue = new RecordingQueue({ ...leaseFor(1), status: "queued" });

    await expect(
      new GenerationJobWorker(queue, mockGenerationProvider).runOnce(),
    ).rejects.toBeInstanceOf(InvalidGenerationJobTransitionError);
    expect(queue.calls.some((call) => call.kind === "succeed")).toBe(false);
  });

  it("reports every settled job to its observer and stays quiet when idle", async () => {
    const settled: SettledGenerationJob[] = [];
    const observer = {
      settled: (job: SettledGenerationJob) => {
        settled.push(job);
      },
    };

    await new GenerationJobWorker(
      new RecordingQueue(undefined),
      mockGenerationProvider,
      defaultExecutionPolicy,
      observer,
    ).runOnce();
    expect(settled).toEqual([]);

    await new GenerationJobWorker(
      new RecordingQueue(leaseFor(2)),
      mockGenerationProvider,
      defaultExecutionPolicy,
      observer,
    ).runOnce();
    await new GenerationJobWorker(
      new RecordingQueue(leaseFor(3)),
      failingProvider(new PermanentProviderError("prompt is rejected")),
      defaultExecutionPolicy,
      observer,
    ).runOnce();

    expect(settled).toEqual([
      {
        jobId: "6430a8ca-6c92-4cc3-81f9-4f6ee93db23f",
        attempt: 2,
        outcome: "succeeded",
      },
      {
        jobId: "6430a8ca-6c92-4cc3-81f9-4f6ee93db23f",
        attempt: 3,
        outcome: "failed",
      },
    ]);
  });

  it("parks work the provider accepted and releases the lease", async () => {
    const queue = new RecordingQueue(leaseFor(1));
    const worker = new GenerationJobWorker(queue, {
      async generate() {
        return { status: "accepted", reference: "http:accepted" };
      },
    });

    await expect(worker.runOnce()).resolves.toBe("awaiting");
    expect(queue.calls.at(-1)).toEqual({
      kind: "await",
      reference: "http:accepted",
      deadlineSeconds: 60,
    });
  });

  it("reports a lost lease when the result no longer applies", async () => {
    const queue = new RecordingQueue(leaseFor(1), false);

    await expect(
      new GenerationJobWorker(queue, mockGenerationProvider).runOnce(),
    ).resolves.toBe("lost");
  });
});
