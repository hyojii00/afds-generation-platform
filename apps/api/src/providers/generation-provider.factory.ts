import {
  type GenerationProviderPort,
  mockGenerationProvider,
} from "@afds-generation-platform/generation";
import { HttpGenerationProvider } from "./http-generation.provider.js";

const defaultTimeoutMs = 5_000;

/**
 * Chooses the provider from configuration: an HTTP provider when
 * `PROVIDER_BASE_URL` is set, the in-process mock provider otherwise. The
 * timeout stays well inside the worker's lease so a slow provider cannot
 * outlive its ownership of a job.
 */
export function createGenerationProvider(
  environment: NodeJS.ProcessEnv = process.env,
  leaseSeconds?: number,
): GenerationProviderPort {
  const configuredBaseUrl = environment.PROVIDER_BASE_URL;

  if (configuredBaseUrl === undefined) {
    return mockGenerationProvider;
  }

  const baseUrl = configuredBaseUrl.trim();

  if (baseUrl.length === 0) {
    throw new Error(
      "PROVIDER_BASE_URL is set but empty; unset it to run the mock provider",
    );
  }

  const configured = Number(environment.PROVIDER_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configured) && configured > 0
      ? configured
      : defaultTimeoutMs;

  if (leaseSeconds !== undefined && timeoutMs >= leaseSeconds * 1_000) {
    throw new Error(
      `PROVIDER_TIMEOUT_MS must stay under the ${leaseSeconds}s lease`,
    );
  }

  return new HttpGenerationProvider({
    baseUrl,
    apiKey: environment.PROVIDER_API_KEY,
    timeoutMs,
  });
}
