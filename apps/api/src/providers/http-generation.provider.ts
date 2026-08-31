import {
  type GenerationProviderPort,
  PermanentProviderError,
  type ProviderRequest,
  type ProviderResult,
  TransientProviderError,
} from "@afds-generation-platform/generation";

export type HttpProviderConfig = Readonly<{
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}>;

type ProviderBody = { id?: unknown };

/** Releases the connection for a response whose body is never read. */
async function discard(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

/**
 * Normalizes one request/response provider. The job identifier travels as the
 * idempotency key, so a retried attempt cannot duplicate accepted work.
 *
 * Failures carry the HTTP status and a fixed reason. Response bodies, request
 * bodies, and credentials never reach the error or the caller.
 */
export class HttpGenerationProvider implements GenerationProviderPort {
  private readonly endpoint: URL;

  constructor(private readonly config: HttpProviderConfig) {
    const base = config.baseUrl.endsWith("/")
      ? config.baseUrl
      : `${config.baseUrl}/`;

    try {
      this.endpoint = new URL("generations", base);
    } catch {
      throw new Error(
        `PROVIDER_BASE_URL is not a valid URL: ${config.baseUrl}`,
      );
    }
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    const response = await this.post(request);

    if (response.status === 429 || response.status >= 500) {
      await discard(response);
      throw new TransientProviderError(
        "provider is unavailable",
        response.status,
      );
    }

    if (!response.ok) {
      await discard(response);
      throw new PermanentProviderError(
        "provider rejected the request",
        response.status,
      );
    }

    return { reference: await this.reference(response) };
  }

  private async post(request: ProviderRequest): Promise<Response> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "idempotency-key": request.jobId,
    };

    if (this.config.apiKey) {
      headers.authorization = `Bearer ${this.config.apiKey}`;
    }

    try {
      return await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: request.prompt,
          provider: request.provider,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw this.transportFailure(error);
    }
  }

  /** A call that never completed is always worth another attempt. */
  private transportFailure(error: unknown): TransientProviderError {
    return new TransientProviderError(
      error instanceof Error && error.name === "TimeoutError"
        ? `provider did not answer within ${this.config.timeoutMs}ms`
        : "provider is unreachable",
    );
  }

  private async reference(response: Response): Promise<string> {
    let body: ProviderBody;

    try {
      body = (await response.json()) as ProviderBody;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new PermanentProviderError(
          "provider returned an unreadable body",
          response.status,
        );
      }

      throw this.transportFailure(error);
    }

    if (typeof body.id !== "string" || body.id.length === 0) {
      throw new PermanentProviderError(
        "provider returned no generation identifier",
        response.status,
      );
    }

    return `http:${body.id}`;
  }
}
