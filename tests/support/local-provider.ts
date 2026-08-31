import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { setTimeout as delay } from "node:timers/promises";

export type LocalProvider = {
  url: string;
  /** How many times the provider actually did the work for a key. */
  executions(idempotencyKey: string): number;
  receivedAuthorization(): string | undefined;
  close(): Promise<void>;
};

/**
 * A local stand-in for a request/response generation provider. The prompt
 * selects the scenario, and the idempotency key makes repeated requests return
 * the first result without doing the work again.
 */
export async function startLocalProvider(): Promise<LocalProvider> {
  const references = new Map<string, string>();
  const executions = new Map<string, number>();
  let authorization: string | undefined;

  const server: Server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", async () => {
      authorization = request.headers.authorization;
      const key = String(request.headers["idempotency-key"] ?? "");
      const prompt = String(
        (JSON.parse(body || "{}") as { prompt?: unknown }).prompt ?? "",
      );

      const answer = (status: number, payload?: unknown) => {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(payload === undefined ? "" : JSON.stringify(payload));
      };

      if (prompt.includes("rate-limited")) {
        answer(429, { error: "slow down", secret: "provider-internal" });
        return;
      }

      if (prompt.includes("unavailable")) {
        answer(503, { error: "upstream is down", secret: "provider-internal" });
        return;
      }

      if (prompt.includes("unreadable")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end("{not json");
        return;
      }

      if (prompt.includes("anonymous")) {
        answer(200, { status: "accepted" });
        return;
      }

      if (prompt.includes("slow")) {
        await delay(2_000);
        answer(200, { id: "too-late" });
        return;
      }

      if (prompt.trim().length === 0) {
        answer(422, {
          error: "prompt is required",
          secret: "provider-internal",
        });
        return;
      }

      const existing = references.get(key);
      if (existing) {
        answer(200, { id: existing });
        return;
      }

      const reference = createHash("sha256")
        .update(key)
        .digest("hex")
        .slice(0, 16);
      references.set(key, reference);
      executions.set(key, (executions.get(key) ?? 0) + 1);
      answer(201, { id: reference });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("expected a TCP address for the local provider");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    executions: (key) => executions.get(key) ?? 0,
    receivedAuthorization: () => authorization,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
