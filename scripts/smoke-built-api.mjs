import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const apiProcess = spawn(process.execPath, ["apps/api/dist/main.js"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let processOutput = "";

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
      const response = await fetch("http://127.0.0.1:3000/v1/jobs/missing");
      if (response.status === 404) {
        return;
      }
    } catch {}

    await delay(100);
  }

  throw new Error(`Built API did not start in time:\n${processOutput}`);
}

try {
  await waitForApi();

  const createdResponse = await fetch("http://127.0.0.1:3000/v1/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "SWC-built Fastify API", provider: "mock" }),
  });
  if (createdResponse.status !== 201) {
    throw new Error(
      `Expected create status 201, received ${createdResponse.status}`,
    );
  }
  const created = await createdResponse.json();

  const retrievedResponse = await fetch(
    `http://127.0.0.1:3000/v1/jobs/${created.id}`,
  );
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
  apiProcess.kill("SIGTERM");
  await Promise.race([once(apiProcess, "exit"), delay(1_000)]);
  if (apiProcess.exitCode === null) {
    apiProcess.kill("SIGKILL");
  }
}
