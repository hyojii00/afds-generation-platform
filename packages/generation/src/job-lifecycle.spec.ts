import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  reportedStatus,
  type GenerationJobStatus,
  generationJobStatuses,
  InvalidGenerationJobTransitionError,
} from "./index.js";

const validTransitions: ReadonlyArray<
  [GenerationJobStatus, GenerationJobStatus]
> = [
  ["queued", "processing"],
  ["processing", "awaiting_provider"],
  ["processing", "succeeded"],
  ["processing", "failed"],
  ["processing", "queued"],
  ["awaiting_provider", "succeeded"],
  ["awaiting_provider", "failed"],
  ["awaiting_provider", "queued"],
];

describe("generation job lifecycle", () => {
  it("exposes the five persisted statuses", () => {
    expect(generationJobStatuses).toEqual([
      "queued",
      "processing",
      "awaiting_provider",
      "succeeded",
      "failed",
    ]);
  });

  it("reports waiting work as processing and every other status as itself", () => {
    expect(reportedStatus("awaiting_provider")).toBe("processing");
    for (const status of generationJobStatuses) {
      if (status !== "awaiting_provider") {
        expect(reportedStatus(status)).toBe(status);
      }
    }
  });

  it.each(validTransitions)("accepts %s to %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it("rejects every other transition", () => {
    const invalid = generationJobStatuses.flatMap((from) =>
      generationJobStatuses
        .filter(
          (to) =>
            !validTransitions.some(
              ([validFrom, validTo]) => validFrom === from && validTo === to,
            ),
        )
        .map((to): [GenerationJobStatus, GenerationJobStatus] => [from, to]),
    );

    expect(invalid).toHaveLength(17);
    for (const [from, to] of invalid) {
      expect(canTransition(from, to)).toBe(false);
      expect(() => assertTransition(from, to)).toThrow(
        InvalidGenerationJobTransitionError,
      );
    }
  });

  it("keeps terminal statuses terminal", () => {
    for (const to of generationJobStatuses) {
      expect(canTransition("succeeded", to)).toBe(false);
      expect(canTransition("failed", to)).toBe(false);
    }
  });
});
