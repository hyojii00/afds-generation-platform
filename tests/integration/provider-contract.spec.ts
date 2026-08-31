import {
  type GenerationProviderPort,
  mockGenerationProvider,
  PermanentProviderError,
  type ProviderRequest,
  TransientProviderError,
} from "@afds-generation-platform/generation";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HttpGenerationProvider } from "../../apps/api/src/providers/http-generation.provider.js";
import { createGenerationProvider } from "../../apps/api/src/providers/generation-provider.factory.js";
import {
  type LocalProvider,
  startLocalProvider,
} from "../support/local-provider.js";

const apiKey = "provider-secret-key";

function requestFor(prompt: string, jobId = randomUUID()): ProviderRequest {
  return { jobId, prompt, provider: "mock" };
}

describe("generation provider contract", () => {
  let local: LocalProvider;
  let http: HttpGenerationProvider;

  beforeAll(async () => {
    local = await startLocalProvider();
    http = new HttpGenerationProvider({
      baseUrl: local.url,
      apiKey,
      timeoutMs: 500,
    });
  });

  afterAll(async () => {
    await local.close();
  });

  describe.each([
    ["mock provider", () => mockGenerationProvider],
    ["HTTP provider", () => http as GenerationProviderPort],
  ])("%s", (_name, provider) => {
    it("returns a normalized reference for a generation", async () => {
      const result = await provider().generate(
        requestFor("A cinematic sunrise over Seoul"),
      );

      expect(result.reference).toEqual(expect.any(String));
      expect(result.reference.length).toBeGreaterThan(0);
    });

    it("returns the same reference for the same job", async () => {
      const request = requestFor("A repeated cinematic sunrise");

      const first = await provider().generate(request);
      const second = await provider().generate(request);

      expect(second.reference).toBe(first.reference);
    });

    it("rejects an unusable request permanently", async () => {
      await expect(
        provider().generate(requestFor("   ")),
      ).rejects.toBeInstanceOf(PermanentProviderError);
    });
  });

  describe("HTTP provider classification", () => {
    it.each([
      ["rate-limited", 429],
      ["unavailable", 503],
    ])("treats %s as transient", async (prompt, status) => {
      const failure = await http.generate(requestFor(prompt)).catch((e) => e);

      expect(failure).toBeInstanceOf(TransientProviderError);
      expect(failure.status).toBe(status);
    });

    it("treats a timeout as transient", async () => {
      const failure = await http.generate(requestFor("slow")).catch((e) => e);

      expect(failure).toBeInstanceOf(TransientProviderError);
      expect(failure.message).toContain("did not answer within 500ms");
    });

    it("treats a body that stops mid-stream as transient", async () => {
      const failure = await http
        .generate(requestFor("stalled"))
        .catch((e) => e);

      expect(failure).toBeInstanceOf(TransientProviderError);
      expect(failure.message).toContain("did not answer within 500ms");
    });

    it("keeps the path of a base URL that has one", async () => {
      const prefixed = new HttpGenerationProvider({
        baseUrl: `${local.url}/v1`,
        timeoutMs: 500,
      });

      await expect(
        prefixed.generate(requestFor("A prefixed cinematic sunrise")),
      ).resolves.toMatchObject({ reference: expect.any(String) });
      expect(local.receivedPath()).toBe("/v1/generations");
    });

    it("treats an unreachable provider as transient", async () => {
      const unreachable = new HttpGenerationProvider({
        baseUrl: "http://127.0.0.1:1",
        timeoutMs: 500,
      });

      await expect(
        unreachable.generate(requestFor("A cinematic sunrise over Seoul")),
      ).rejects.toBeInstanceOf(TransientProviderError);
    });

    it.each([
      ["unreadable", "unreadable body"],
      ["anonymous", "no generation identifier"],
    ])(
      "treats an unusable success body (%s) as permanent",
      async (prompt, reason) => {
        const failure = await http.generate(requestFor(prompt)).catch((e) => e);

        expect(failure).toBeInstanceOf(PermanentProviderError);
        expect(failure.message).toContain(reason);
      },
    );

    it("sends the job identifier as an idempotency key and works once", async () => {
      const request = requestFor("An idempotent cinematic sunrise");

      const first = await http.generate(request);
      const second = await http.generate(request);

      expect(second.reference).toBe(first.reference);
      expect(local.executions(request.jobId)).toBe(1);
    });

    it("keeps credentials and provider payloads out of failures", async () => {
      const failure = await http
        .generate(requestFor("unavailable"))
        .catch((e) => e);

      expect(local.receivedAuthorization()).toBe(`Bearer ${apiKey}`);
      expect(failure.message).not.toContain(apiKey);
      expect(failure.message).not.toContain("provider-internal");
      expect(failure.message).not.toContain("upstream is down");
      expect(failure.message).toBe("provider 503: provider is unavailable");
    });
  });

  describe("provider selection", () => {
    it("uses the in-process mock provider without a base URL", () => {
      expect(createGenerationProvider({}, 30)).toBe(mockGenerationProvider);
    });

    it("uses the HTTP provider when a base URL is configured", () => {
      expect(
        createGenerationProvider({ PROVIDER_BASE_URL: local.url }, 30),
      ).toBeInstanceOf(HttpGenerationProvider);
    });

    it("refuses a base URL that is set but empty", () => {
      expect(() =>
        createGenerationProvider({ PROVIDER_BASE_URL: "   " }, 30),
      ).toThrow("set but empty");
    });

    it("refuses a base URL that is not a URL", () => {
      expect(() =>
        createGenerationProvider({ PROVIDER_BASE_URL: "api.example.com" }, 30),
      ).toThrow("not a valid URL");
    });

    it("refuses a timeout that outlives the lease", () => {
      expect(() =>
        createGenerationProvider(
          { PROVIDER_BASE_URL: local.url, PROVIDER_TIMEOUT_MS: "30000" },
          30,
        ),
      ).toThrow("must stay under the 30s lease");
    });
  });
});
