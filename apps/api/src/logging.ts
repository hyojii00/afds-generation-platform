import type { SettledGenerationJob } from "@afds-generation-platform/generation";

type Level = "info" | "error";

/**
 * Writes one JSON line per event. Only the fields named here are logged, so a
 * prompt, a callback token, a credential, or a provider payload cannot reach
 * the log through this adapter.
 */
export function logEvent(
  level: Level,
  event: string,
  fields: Record<string, string | number> = {},
): void {
  if (process.env.LOG_LEVEL === "silent") {
    return;
  }

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    ...fields,
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export const jobLogObserver = {
  settled(job: SettledGenerationJob): void {
    logEvent("info", "generation_job.settled", {
      jobId: job.jobId,
      attempt: job.attempt,
      outcome: job.outcome,
    });
  },
};
