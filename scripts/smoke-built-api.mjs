import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 30_000 + (process.pid % 20_000);
const apiUrl = `http://127.0.0.1:${port}`;
const apiProcess = spawn(process.execPath, ["apps/api/dist/main.js"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
const apiExit = once(apiProcess, "exit");
let processOutput = "";
let lastConnectionError;

apiProcess.stdout.on("data", (chunk) => {
  processOutput += chunk;
});
apiProcess.stderr.on("data", (chunk) => {
  processOutput += chunk;
});

async function waitForApi() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`Built API exited before startup:\n${processOutput}`);
    }

    try {
      const response = await fetch(`${apiUrl}/v1/jobs/missing`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.status === 404) {
        return;
      }
    } catch (error) {
      lastConnectionError = error;
    }

    await delay(100);
  }

  const connectionFailure =
    lastConnectionError instanceof Error
      ? `\nLast connection error: ${lastConnectionError.message}`
      : "";
  throw new Error(
    `Built API did not start in time:${connectionFailure}\n${processOutput}`,
  );
}

try {
  await waitForApi();

  const createdResponse = await fetch(`${apiUrl}/v1/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "SWC-built Fastify API", provider: "mock" }),
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
  if (apiProcess.exitCode === null) {
    apiProcess.kill("SIGTERM");
    const exited = await Promise.race([
      apiExit.then(() => true),
      delay(1_000).then(() => false),
    ]);
    if (!exited) {
      apiProcess.kill("SIGKILL");
      await apiExit;
    }
  }
}
