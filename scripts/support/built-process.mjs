import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

/** Starts a built entrypoint and collects its output for failure messages. */
export function startBuiltProcess(entrypoint, env) {
  const child = spawn(process.execPath, [entrypoint], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let spawnError;
  const exited = new Promise((resolve) => {
    child.once("exit", resolve);
    child.once("error", (error) => {
      spawnError = error;
      output += `${error.stack ?? error.message}\n`;
      resolve(null);
    });
  });

  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  return {
    entrypoint,
    child,
    exited,
    get output() {
      return output;
    },
    running() {
      return (
        spawnError === undefined &&
        child.exitCode === null &&
        child.signalCode === null
      );
    },
    async stop() {
      if (spawnError) {
        throw spawnError;
      }

      if (!this.running()) {
        return child.exitCode;
      }

      child.kill("SIGTERM");
      const stopped = await Promise.race([
        exited.then(() => true),
        delay(5_000).then(() => false),
      ]);

      if (!stopped) {
        child.kill("SIGKILL");
        await exited;
        throw new Error(`${entrypoint} ignored SIGTERM:\n${output}`);
      }

      return child.exitCode;
    },
  };
}

/**
 * Polls `check` until it returns a defined value, failing with the process
 * output when the entrypoint exits early or the deadline passes.
 */
export async function waitFor(
  description,
  process_,
  check,
  { attempts = 100, intervalMs = 100 } = {},
) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!process_.running()) {
      throw new Error(
        `${process_.entrypoint} exited while waiting for ${description}:\n${process_.output}`,
      );
    }

    try {
      const result = await check();
      if (result !== undefined) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(intervalMs);
  }

  const cause =
    lastError instanceof Error ? `\nLast error: ${lastError.message}` : "";
  throw new Error(
    `Timed out waiting for ${description}:${cause}\n${process_.output}`,
  );
}
