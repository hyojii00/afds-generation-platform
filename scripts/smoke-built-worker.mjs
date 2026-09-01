import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { startBuiltProcess, waitFor } from "./support/built-process.mjs";

const { Pool } = pg;
const postgres = await new PostgreSqlContainer("postgres:18-alpine").start();

try {
  const databaseUrl = postgres.getConnectionUri();
  const migrationPool = new Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(migrationPool), { migrationsFolder: "drizzle" });
  } finally {
    await migrationPool.end();
  }

  const port = 50_000 + (process.pid % 10_000);
  const apiUrl = `http://127.0.0.1:${port}`;
  const api = startBuiltProcess("apps/api/dist/main.js", {
    DATABASE_URL: databaseUrl,
    PORT: String(port),
    LOG_LEVEL: "silent",
  });

  try {
    await waitFor("the built API to answer", api, async () => {
      const response = await fetch(`${apiUrl}/v1/jobs/missing`, {
        signal: AbortSignal.timeout(500),
      });
      return response.status === 404 ? true : undefined;
    });

    const createdResponse = await fetch(`${apiUrl}/v1/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "SWC-built generation worker",
        provider: "mock",
      }),
      signal: AbortSignal.timeout(1_000),
    });
    if (createdResponse.status !== 201) {
      throw new Error(
        `Expected create status 201, received ${createdResponse.status}`,
      );
    }
    const created = await createdResponse.json();
    if (created.status !== "queued") {
      throw new Error(`Expected a queued job, received ${created.status}`);
    }

    const worker = startBuiltProcess("apps/api/dist/worker.main.js", {
      DATABASE_URL: databaseUrl,
      LOG_LEVEL: "info",
    });
    const settled = () =>
      worker.output
        .split("\n")
        .filter((line) => line.includes('"generation_job.settled"'));

    let workerExitCode;

    try {
      const executed = await waitFor(
        "the built worker to finish the job",
        worker,
        async () => {
          const response = await fetch(`${apiUrl}/v1/jobs/${created.id}`, {
            signal: AbortSignal.timeout(1_000),
          });
          const job = await response.json();
          return job.status === "queued" || job.status === "processing"
            ? undefined
            : job;
        },
      );

      if (executed.status !== "succeeded") {
        throw new Error(
          `Expected the worker to succeed, received ${executed.status}`,
        );
      }

      if (
        JSON.stringify(executed) !==
        JSON.stringify({ ...created, status: "succeeded" })
      ) {
        throw new Error(
          "Built worker changed a field other than the job status",
        );
      }
      const [line] = settled();
      const event = JSON.parse(line ?? "{}");
      if (event.jobId !== created.id || event.outcome !== "succeeded") {
        throw new Error(
          `Built worker did not log the settled job:\n${worker.output}`,
        );
      }
    } finally {
      workerExitCode = await worker.stop();
    }

    if (workerExitCode !== 0) {
      throw new Error(
        `Built worker exited with ${workerExitCode} instead of stopping cleanly:\n${worker.output}`,
      );
    }

    console.log("SWC-built generation worker smoke test passed.");
  } finally {
    await api.stop();
  }
} finally {
  await postgres.stop();
}
