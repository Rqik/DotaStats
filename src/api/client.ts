import type { z } from 'zod';

export type ApiErrorKind = 'network' | 'http' | 'not_found' | 'rate_limit' | 'invalid_request' | 'invalid_schema' | 'timeout';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(kind: ApiErrorKind, message: string, options: { status?: number; retryAfterMs?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export interface OpenDotaClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const DEFAULT_BASE_URL = 'https://api.opendota.com/api';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 1;
const MAX_RETRY_AFTER_MS = 30_000;

const defaultSleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryAfterMs(headers: Headers): number | undefined {
  const value = headers.get('retry-after');
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_AFTER_MS);
}

function httpError(response: Response): ApiError {
  const retryAfter = retryAfterMs(response.headers);
  if (response.status === 404) return new ApiError('not_found', 'OpenDota resource was not found', { status: 404 });
  if (response.status === 429) return new ApiError('rate_limit', 'OpenDota rate limit exceeded', { status: 429, retryAfterMs: retryAfter });
  return new ApiError('http', `OpenDota request failed with HTTP ${response.status}`, { status: response.status, retryAfterMs: retryAfter });
}

export class OpenDotaClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: OpenDotaClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, '')}`);
    if (this.apiKey) url.searchParams.set('api_key', this.apiKey);

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.fetchAndParse(url, schema);
      } catch (error) {
        const apiError = error instanceof ApiError ? error : new ApiError('network', 'Could not connect to OpenDota', { cause: error });
        const retryable = apiError.kind === 'rate_limit' || (apiError.kind === 'http' && (apiError.status ?? 0) >= 500);
        if (!retryable || attempt >= this.maxRetries) throw apiError;
        await this.sleep(apiError.retryAfterMs ?? 250);
      }
    }
  }

  private async fetchAndParse<T>(url: URL, schema: z.ZodType<T>): Promise<T> {
    const controller = new AbortController();
    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchFn(url, { method: 'GET', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw httpError(response);
      const json: unknown = await response.json();
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new ApiError('invalid_schema', 'OpenDota returned an unexpected response shape', { cause: parsed.error });
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (didTimeout || controller.signal.aborted) throw new ApiError('timeout', 'OpenDota request timed out', { cause: error });
      throw new ApiError('network', 'Could not connect to OpenDota', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}
