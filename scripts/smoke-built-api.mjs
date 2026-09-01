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

  const port = 30_000 + (process.pid % 20_000);
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

    const healthResponse = await fetch(`${apiUrl}/health`, {
      signal: AbortSignal.timeout(1_000),
    });
    if (healthResponse.status !== 200) {
      throw new Error(
        `Expected health status 200, received ${healthResponse.status}`,
      );
    }
    const health = await healthResponse.json();
    if (health.status !== "ok") {
      throw new Error(`Expected a healthy API, received ${health.status}`);
    }

    const createdResponse = await fetch(`${apiUrl}/v1/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "SWC-built Fastify API",
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

    const retrievedResponse = await fetch(`${apiUrl}/v1/jobs/${created.id}`, {
      signal: AbortSignal.timeout(1_000),
    });
    if (retrievedResponse.status !== 200) {
      throw new Error(
        `Expected retrieve status 200, received ${retrievedResponse.status}`,
      );
    }
    const retrieved = await retrievedResponse.json();

    if (JSON.stringify(retrieved) !== JSON.stringify(created)) {
      throw new Error("Built API returned a different job than it created");
    }

    console.log("SWC-built Fastify API smoke test passed.");
  } finally {
    await api.stop();
  }
} finally {
  await postgres.stop();
}
