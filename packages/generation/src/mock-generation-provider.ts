import {
  type GenerationProviderPort,
  PermanentProviderError,
  type ProviderOutcome,
  type ProviderRequest,
} from "./generation-provider.js";

/**
 * Deterministic, side-effect-free provider. The reference derives from the
 * job identifier, so repeating a request yields the same reference.
 */
export const mockGenerationProvider: GenerationProviderPort = {
  async generate(request: ProviderRequest): Promise<ProviderOutcome> {
    if (request.provider !== "mock") {
      throw new PermanentProviderError(
        `unsupported provider ${request.provider}`,
      );
    }

    if (request.prompt.trim().length === 0) {
      throw new PermanentProviderError("prompt is empty");
    }

    return { status: "completed", reference: `mock:${request.jobId}` };
  },
};
