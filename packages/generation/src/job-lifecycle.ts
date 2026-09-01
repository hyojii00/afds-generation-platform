export type GenerationJobStatus =
  | "queued"
  | "processing"
  | "awaiting_provider"
  | "succeeded"
  | "failed";

/** The values `GET /v1/jobs/:id` reports; `awaiting_provider` is internal. */
export type ReportedGenerationJobStatus = Exclude<
  GenerationJobStatus,
  "awaiting_provider"
>;

export const generationJobStatuses: readonly GenerationJobStatus[] = [
  "queued",
  "processing",
  "awaiting_provider",
  "succeeded",
  "failed",
];

/**
 * Waiting for a provider is still work in progress, so clients keep the four
 * statuses Loop 003 defined.
 */
export function reportedStatus(
  status: GenerationJobStatus,
): ReportedGenerationJobStatus {
  return status === "awaiting_provider" ? "processing" : status;
}

const allowedTransitions: Readonly<
  Record<GenerationJobStatus, readonly GenerationJobStatus[]>
> = {
  queued: ["processing"],
  processing: ["awaiting_provider", "succeeded", "failed", "queued"],
  awaiting_provider: ["succeeded", "failed", "queued"],
  succeeded: [],
  failed: [],
};

export class InvalidGenerationJobTransitionError extends Error {
  constructor(
    readonly from: GenerationJobStatus,
    readonly to: GenerationJobStatus,
  ) {
    super(`Generation job cannot move from ${from} to ${to}`);
  }
}

export function canTransition(
  from: GenerationJobStatus,
  to: GenerationJobStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTransition(
  from: GenerationJobStatus,
  to: GenerationJobStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidGenerationJobTransitionError(from, to);
  }
}
