export type GenerationJobStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed";

export const generationJobStatuses: readonly GenerationJobStatus[] = [
  "queued",
  "processing",
  "succeeded",
  "failed",
];

const allowedTransitions: Readonly<
  Record<GenerationJobStatus, readonly GenerationJobStatus[]>
> = {
  queued: ["processing"],
  processing: ["succeeded", "failed", "queued"],
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
