import { afterEach, describe, expect, it, vi } from "vitest";
import { jobLogObserver, logEvent } from "../../apps/api/src/logging.js";

function captureLines(level: "log" | "error") {
  const lines: string[] = [];
  const spy = vi
    .spyOn(console, level)
    .mockImplementation((line: unknown) => void lines.push(String(line)));

  return { lines, spy };
}

describe("structured logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it("writes one JSON line carrying the event and its fields", () => {
    const { lines } = captureLines("log");

    logEvent("info", "worker.started");
    logEvent("info", "generation_job.settled", { jobId: "abc", attempt: 2 });

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      time: expect.any(String),
      level: "info",
      event: "worker.started",
    });
    expect(JSON.parse(lines[1] ?? "")).toEqual({
      time: expect.any(String),
      level: "info",
      event: "generation_job.settled",
      jobId: "abc",
      attempt: 2,
    });
  });

  it("writes an error event to standard error", () => {
    const { lines } = captureLines("error");

    logEvent("error", "worker.failed", { reason: "connection reset" });

    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      level: "error",
      event: "worker.failed",
      reason: "connection reset",
    });
  });

  it("logs a settled job without its prompt, token, or provider payload", () => {
    const { lines } = captureLines("log");

    jobLogObserver.settled({
      jobId: "6430a8ca-6c92-4cc3-81f9-4f6ee93db23f",
      attempt: 1,
      outcome: "succeeded",
    });

    expect(JSON.parse(lines[0] ?? "")).toEqual({
      time: expect.any(String),
      level: "info",
      event: "generation_job.settled",
      jobId: "6430a8ca-6c92-4cc3-81f9-4f6ee93db23f",
      attempt: 1,
      outcome: "succeeded",
    });
  });

  it("stays silent at the silent level", () => {
    process.env.LOG_LEVEL = "silent";
    const { lines } = captureLines("log");

    logEvent("info", "worker.started");

    expect(lines).toEqual([]);
  });
});
