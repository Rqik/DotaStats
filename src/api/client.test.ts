import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, OpenDotaClient } from './client';

const schema = z.object({ id: z.number() }).passthrough();
const response = (body: unknown, status = 200, headers?: HeadersInit): Response => new Response(JSON.stringify(body), { status, headers });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenDotaClient', () => {
  it('binds the default native fetch receiver to globalThis', async () => {
    let calls = 0;
    const receiverSensitiveFetch: typeof fetch = function fetchWithNativeReceiver(this: unknown): Promise<Response> {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      calls += 1;
      return Promise.resolve(response({ id: 7 }));
    };
    vi.stubGlobal('fetch', receiverSensitiveFetch);

    const client = new OpenDotaClient();

    await expect(client.get('/heroes', schema)).resolves.toEqual({ id: 7 });
    expect(calls).toBe(1);
  });

  it('returns schema-validated data and appends a personal API key', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(response({ id: 7, future_field: true }));
    const client = new OpenDotaClient({ apiKey: 'local-key', fetchFn });
    await expect(client.get('/heroes', schema)).resolves.toMatchObject({ id: 7, future_field: true });
    expect(String(fetchFn.mock.calls[0][0])).toBe('https://api.opendota.com/api/heroes?api_key=local-key');
  });

  it('maps malformed successful data to invalid_schema', async () => {
    const client = new OpenDotaClient({ fetchFn: vi.fn<typeof fetch>().mockResolvedValue(response({ id: '7' })) });
    await expect(client.get('/heroes', schema)).rejects.toMatchObject({ kind: 'invalid_schema' } satisfies Partial<ApiError>);
  });

  it('maps HTTP 404 to not_found without retrying', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(response({}, 404));
    const client = new OpenDotaClient({ fetchFn });
    await expect(client.get('/matches/1', schema)).rejects.toMatchObject({ kind: 'not_found', status: 404 } satisfies Partial<ApiError>);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 once, respecting Retry-After', async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, 429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(response({ id: 9 }));
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue();
    const client = new OpenDotaClient({ fetchFn, sleep, maxRetries: 1 });
    await expect(client.get('/teams', schema)).resolves.toEqual({ id: 9 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('maps an aborted request caused by timeout', async () => {
    const fetchFn = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const client = new OpenDotaClient({ fetchFn: fetchFn as typeof fetch, timeoutMs: 1, maxRetries: 0 });
    await expect(client.get('/teams', schema)).rejects.toMatchObject({ kind: 'timeout' } satisfies Partial<ApiError>);
  });
});
