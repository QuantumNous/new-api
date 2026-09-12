import { DownloadError } from '@ai-sdk/provider-utils';
import { download } from './download';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

describe('download SSRF protection', () => {
  it('should reject private IPv4 addresses', async () => {
    await expect(
      download({ url: new URL('http://127.0.0.1/file') }),
    ).rejects.toThrow(DownloadError);
    await expect(
      download({ url: new URL('http://10.0.0.1/file') }),
    ).rejects.toThrow(DownloadError);
    await expect(
      download({ url: new URL('http://169.254.169.254/latest/meta-data/') }),
    ).rejects.toThrow(DownloadError);
  });

  it('should reject localhost', async () => {
    await expect(
      download({ url: new URL('http://localhost/file') }),
    ).rejects.toThrow(DownloadError);
  });
});

describe('download SSRF redirect protection', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should reject a redirect to a private IP without requesting it', async () => {
    const onCancel = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: new Headers({
        location: 'http://169.254.169.254/latest/meta-data/',
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('redirecting'));
          controller.close();
        },
        cancel() {
          onCancel();
        },
      }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await expect(
      download({ url: new URL('https://evil.com/redirect') }),
    ).rejects.toThrow(DownloadError);
    // The redirect target must never be requested.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Body must be cancelled so the open-redirect rejection does not leak the
    // underlying socket.
    expect(onCancel).toHaveBeenCalled();
  });

  it('should reject a redirect to localhost without requesting it', async () => {
    const onCancel = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 307,
      headers: new Headers({ location: 'http://localhost:8080/admin' }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('redirecting'));
          controller.close();
        },
        cancel() {
          onCancel();
        },
      }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await expect(
      download({ url: new URL('https://evil.com/redirect') }),
    ).rejects.toThrow(DownloadError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalled();
  });

  it('should let the browser follow redirects natively on an opaque redirect', async () => {
    const globalThisAny = globalThis as { window?: unknown };
    globalThisAny.window = {};
    const content = new Uint8Array([1, 2, 3]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        type: 'opaqueredirect',
        status: 0,
        ok: false,
        headers: new Headers(),
        body: null,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(content);
            controller.close();
          },
        }),
      } as unknown as Response);
    globalThis.fetch = fetchMock;

    try {
      const result = await download({
        url: new URL('https://example.com/image.png'),
      });
      expect(result.data).toEqual(content);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://example.com/image.png',
        expect.objectContaining({ redirect: 'manual' }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://example.com/image.png',
        expect.objectContaining({ redirect: 'follow' }),
      );
    } finally {
      delete globalThisAny.window;
    }
  });

  it('should fail closed on an opaque redirect outside the browser', async () => {
    // A spec-compliant server runtime may return an opaque redirect for
    // `redirect: 'manual'`. Since the hop cannot be validated and SSRF is
    // reachable on the server, we must reject rather than follow it natively.
    const fetchMock = vi.fn().mockResolvedValueOnce({
      type: 'opaqueredirect',
      status: 0,
      ok: false,
      headers: new Headers(),
      body: null,
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await expect(
      download({ url: new URL('https://example.com/redirect') }),
    ).rejects.toThrow(DownloadError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should follow redirects to safe URLs', async () => {
    const content = new Uint8Array([1, 2, 3]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ location: 'https://cdn.example.com/image.png' }),
        body: null,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(content);
            controller.close();
          },
        }),
      } as unknown as Response);
    globalThis.fetch = fetchMock;

    const result = await download({
      url: new URL('https://example.com/image.png'),
    });
    expect(result.data).toEqual(content);
    expect(result.mediaType).toBe('image/png');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://cdn.example.com/image.png',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });
});

describe('download', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should download data successfully and match expected bytes', async () => {
    const expectedBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/octet-stream',
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(expectedBytes);
          controller.close();
        },
      }),
    } as unknown as Response);

    const result = await download({
      url: new URL('http://example.com/file'),
    });

    expect(result).not.toBeNull();
    expect(result!.data).toEqual(expectedBytes);
    expect(result!.mediaType).toBe('application/octet-stream');

    expect(fetch).toHaveBeenCalledWith(
      'http://example.com/file',
      expect.objectContaining({
        headers: expect.any(Object),
      }),
    );
  });

  it('should allow inline data URLs', async () => {
    const result = await download({
      url: new URL('data:text/plain;base64,aGVsbG8='),
    });

    expect(result.data).toEqual(new TextEncoder().encode('hello'));
    expect(result.mediaType).toBe('text/plain');
  });

  it('should throw DownloadError when response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
    } as unknown as Response);

    try {
      await download({
        url: new URL('http://example.com/file'),
      });
      expect.fail('Expected download to throw');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DownloadError);
      expect((error as DownloadError).statusCode).toBe(404);
      expect((error as DownloadError).statusText).toBe('Not Found');
    }
  });

  it('should throw DownloadError when fetch throws an error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      await download({
        url: new URL('http://example.com/file'),
      });
      expect.fail('Expected download to throw');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DownloadError);
    }
  });

  it('should cancel the body on non-ok response (prevents socket leak)', async () => {
    const onCancel = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(10));
          controller.close();
        },
        cancel() {
          onCancel();
        },
      }),
    } as unknown as Response);

    await expect(
      download({ url: new URL('http://example.com/not-found') }),
    ).rejects.toThrow(DownloadError);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should cancel the body when Content-Length exceeds limit (prevents socket leak)', async () => {
    const onCancel = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/octet-stream',
        'content-length': `${3 * 1024 * 1024 * 1024}`,
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(10));
          controller.close();
        },
        cancel() {
          onCancel();
        },
      }),
    } as unknown as Response);

    await expect(
      download({ url: new URL('http://example.com/large') }),
    ).rejects.toThrow(DownloadError);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should abort when response exceeds default size limit', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/octet-stream',
        'content-length': `${3 * 1024 * 1024 * 1024}`,
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(10));
          controller.close();
        },
      }),
    } as unknown as Response);

    try {
      await download({
        url: new URL('http://example.com/large'),
      });
      expect.fail('Expected download to throw');
    } catch (error: unknown) {
      expect(DownloadError.isInstance(error)).toBe(true);
      expect((error as DownloadError).message).toContain(
        'exceeded maximum size',
      );
    }
  });

  it('should pass abortSignal to fetch', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        new DOMException('The operation was aborted.', 'AbortError'),
      );

    try {
      await download({
        url: new URL('http://example.com/file'),
        abortSignal: controller.signal,
      });
      expect.fail('Expected download to throw');
    } catch (error: unknown) {
      expect(DownloadError.isInstance(error)).toBe(true);
    }

    expect(fetch).toHaveBeenCalledWith(
      'http://example.com/file',
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });
});
