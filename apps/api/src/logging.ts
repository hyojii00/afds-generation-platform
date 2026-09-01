import type { SettledGenerationJob } from "@afds-generation-platform/generation";

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug" | "trace";

const severity: Record<LogLevel, number> = {
  silent: 0,
  error: 10,
  warn: 20,
  info: 30,
  debug: 40,
  trace: 50,
};

/** Falls back to `info` for an empty, misspelled, or differently cased value. */
export function resolveLogLevel(configured: string | undefined): LogLevel {
  const normalized = configured?.trim().toLowerCase();

  return normalized && normalized in severity
    ? (normalized as LogLevel)
    : "info";
}

/**
 * A provider callback authenticates with the token in its path, so the path
 * must never reach a log line. The job identifier stays, because a log is
 * where an operator follows one job.
 */
export function redactCallbackToken(url: string): string {
  return url.replace(
    /^(\/v1\/provider-callbacks\/[^/?#]+)\/[^/?#]+/,
    "$1/[redacted]",
  );
}

/**
 * Writes one JSON line per event. Only the fields named here are logged, so a
 * prompt, a callback token, a credential, or a provider payload cannot reach
 * the log through this adapter.
 */
export function logEvent(
  level: Exclude<LogLevel, "silent">,
  event: string,
  fields: Record<string, string | number> = {},
): void {
  if (severity[level] > severity[resolveLogLevel(process.env.LOG_LEVEL)]) {
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

/** Request logging that records the route without its secrets. */
export function requestLoggerOptions(environment: NodeJS.ProcessEnv) {
  return {
    level: resolveLogLevel(environment.LOG_LEVEL),
    serializers: {
      req(request: { method: string; url: string }) {
        return {
          method: request.method,
          url: redactCallbackToken(request.url),
        };
      },
    },
  };
}
