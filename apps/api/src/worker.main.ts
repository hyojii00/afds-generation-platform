import {
  defaultExecutionPolicy,
  GenerationJobWorker,
} from "@afds-generation-platform/generation";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseService } from "./database/database.service.js";
import { PostgresGenerationJobQueue } from "./database/postgres-generation-job.queue.js";
import { jobLogObserver, logEvent } from "./logging.js";
import { createGenerationProvider } from "./providers/generation-provider.factory.js";

const defaultIdleDelayMs = 200;

function idleDelayMs(): number {
  const configured = Number(process.env.WORKER_IDLE_DELAY_MS);

  if (!Number.isFinite(configured) || configured <= 0) {
    return defaultIdleDelayMs;
  }

  return configured;
}

async function run(): Promise<void> {
  const database = new DatabaseService(process.env.DATABASE_URL ?? "");
  await database.assertReady();

  const worker = new GenerationJobWorker(
    new PostgresGenerationJobQueue(database),
    createGenerationProvider(process.env, defaultExecutionPolicy.leaseSeconds),
    defaultExecutionPolicy,
    jobLogObserver,
  );

  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  logEvent("info", "worker.started");

  try {
    while (running) {
      if ((await worker.runOnce()) === "idle") {
        await delay(idleDelayMs());
      }
    }
  } finally {
    await database.close();
    logEvent("info", "worker.stopped");
  }
}

run().catch((error: unknown) => {
  logEvent("error", "worker.failed", {
    reason: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
