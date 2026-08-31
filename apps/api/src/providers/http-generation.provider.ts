import {
  type GenerationProviderPort,
  PermanentProviderError,
  type ProviderOutcome,
  type ProviderRequest,
  TransientProviderError,
} from "@afds-generation-platform/generation";

export type HttpProviderConfig = Readonly<{
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  /** Where the provider reports work it accepted; absent means none. */
  callbackBaseUrl?: string;
}>;

export function callbackPath(jobId: string, token: string): string {
  return `/v1/provider-callbacks/${jobId}/${token}`;
}

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

  async generate(request: ProviderRequest): Promise<ProviderOutcome> {
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

    const reference = await this.reference(response);

    if (response.status !== 202) {
      return { status: "completed", reference };
    }

    if (!this.config.callbackBaseUrl) {
      throw new PermanentProviderError(
        "provider accepted the work but no callback URL is configured",
        response.status,
      );
    }

    return { status: "accepted", reference };
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
          callbackUrl: this.callbackUrl(request),
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw this.transportFailure(error);
    }
  }

  private callbackUrl(request: ProviderRequest): string | undefined {
    if (!this.config.callbackBaseUrl) {
      return undefined;
    }

    return new URL(
      callbackPath(request.jobId, request.callbackToken),
      this.config.callbackBaseUrl,
    ).toString();
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
