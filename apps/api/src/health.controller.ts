import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "./database/database.service.js";
import { logEvent } from "./logging.js";

const checkTimeoutMs = 1_000;

async function withinTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`check exceeded ${checkTimeoutMs}ms`)),
          checkTimeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reports whether this process can serve requests, by running the same query
 * startup uses. The unhealthy answer is a fixed body: the driver's message
 * belongs in the log, not in an unauthenticated response.
 */
@Controller("health")
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async check(): Promise<{ status: "ok" }> {
    try {
      await withinTimeout(this.database.assertReady());
    } catch (error) {
      logEvent("warn", "health.unavailable", {
        reason: error instanceof Error ? error.message : String(error),
      });

      throw new ServiceUnavailableException({ status: "unavailable" });
    }

    return { status: "ok" };
  }
}
