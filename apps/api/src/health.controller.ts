import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "./database/database.service.js";
import { logEvent } from "./logging.js";

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
      await this.database.assertReady();
    } catch (error) {
      logEvent("error", "health.unavailable", {
        reason: error instanceof Error ? error.message : String(error),
      });

      throw new ServiceUnavailableException({ status: "unavailable" });
    }

    return { status: "ok" };
  }
}
