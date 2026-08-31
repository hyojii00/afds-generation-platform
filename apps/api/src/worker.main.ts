import {
  executeMockGeneration,
  GenerationJobWorker,
} from "@afds-generation-platform/generation";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseService } from "./database/database.service.js";
import { PostgresGenerationJobQueue } from "./database/postgres-generation-job.queue.js";

const idleDelayMs = Number(process.env.WORKER_IDLE_DELAY_MS ?? 200);

async function run(): Promise<void> {
  const database = new DatabaseService(process.env.DATABASE_URL ?? "");
  await database.assertReady();

  const worker = new GenerationJobWorker(
    new PostgresGenerationJobQueue(database),
    executeMockGeneration,
  );

  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  console.log("Generation job worker started.");

  try {
    while (running) {
      const outcome = await worker.runOnce();

      if (outcome === "idle") {
        await delay(idleDelayMs);
        continue;
      }

      console.log(`Generation job ${outcome}.`);
    }
  } finally {
    await database.close();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
