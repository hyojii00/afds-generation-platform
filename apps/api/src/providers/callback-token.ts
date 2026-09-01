import { createHash } from "node:crypto";

/**
 * Hashes a callback token the way the claim query does, so only the hash of
 * an attempt's secret is ever stored or compared.
 */
export function hashCallbackToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
