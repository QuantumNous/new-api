import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob } from './download-blob';
import { DownloadError } from './download-error';

function createMockStreamResponse({
  body,
  ok = true,
  status = 200,
  statusText = 'OK',
  headers = {},
  onCancel,
}: {
  body?: Uint8Array;
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  onCancel?: () => void;
}): Response {
  const responseHeaders = new Headers(headers);

  const stream =
    body != null
      ? new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(body);
            controller.close();
          },
          cancel() {
            onCancel?.();
          },
        })
      : null;

  return {
    ok,
    status,
    statusText,
    headers: responseHeaders,
    body: stream,
  } as unknown as Response;
}

describe('downloadBlob()', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should download a blob successfully', async () => {
    const content = new TextEncoder().encode('test content');
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockStreamResponse({
        body: content,
        headers: { 'content-type': 'image/png' },
      }),
    );

    const result = await downloadBlob('https://example.com/image.png');

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/png');
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(content);
    expect(fetch).toHaveBeenCalledWith('https://example.com/image.png', {
      signal: undefined,
      redirect: 'manual',
    });
  });

  it('should throw DownloadError on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockStreamResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    await expect(
      downloadBlob('https://example.com/not-found.png'),
    ).rejects.toThrow(DownloadError);

    try {
      await downloadBlob('https://example.com/not-found.png');
    } catch (error) {
      expect(DownloadError.isInstance(error)).toBe(true);
      if (DownloadError.isInstance(error)) {
        expect(error.url).toBe('https://example.com/not-found.png');
        expect(error.statusCode).toBe(404);
        expect(error.statusText).toBe('Not Found');
        expect(error.message).toBe(
          'Failed to download https://example.com/not-found.png: 404 Not Found',
        );
      }
    }
  });

  it('should throw DownloadError on network error', async () => {
    const networkError = new Error('Network error');
    globalThis.fetch = vi.fn().mockRejectedValue(networkError);

    await expect(
      downloadBlob('https://example.com/network-error.png'),
    ).rejects.toThrow(DownloadError);

    try {
      await downloadBlob('https://example.com/network-error.png');
    } catch (error) {
      expect(DownloadError.isInstance(error)).toBe(true);
      if (DownloadError.isInstance(error)) {
        expect(error.url).toBe('https://example.com/network-error.png');
        expect(error.cause).toBe(networkError);
        expect(error.message).toContain('Network error');
      }
    }
  });

  it('should re-throw DownloadError without wrapping', async () => {
    const originalError = new DownloadError({
      url: 'https://example.com/original.png',
      statusCode: 500,
      statusText: 'Internal Server Error',
    });
    globalThis.fetch = vi.fn().mockRejectedValue(originalError);

    try {
      await downloadBlob('https://example.com/test.png');
    } catch (error) {
      expect(error).toBe(originalError);
      expect(DownloadError.isInstance(error)).toBe(true);
      if (DownloadError.isInstance(error)) {
        expect(error.url).toBe('https://example.com/original.png');
        expect(error.statusCode).toBe(500);
      }
    }
  });

  it('should cancel the body on non-ok response (prevents socket leak)', async () => {
    const onCancel = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockStreamResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        body: new Uint8Array(10),
        onCancel,
      }),
    );

    await expect(
      downloadBlob('https://example.com/not-found.png'),
    ).rejects.toThrow(DownloadError);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should cancel the body when Content-Length exceeds limit (prevents socket leak)', async () => {
    const onCancel = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockStreamResponse({
        body: new Uint8Array(10),
        headers: {
          'content-length': `${3 * 1024 * 1024 * 1024}`,
        },
        onCancel,
      }),
    );

    await expect(downloadBlob('https://example.com/huge.bin')).rejects.toThrow(
      DownloadError,
    );

    expect(onCancel).toHaveBeenCalled();
  });

  it('should abort when response exceeds default size limit', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockStreamResponse({
        body: new Uint8Array(10),
        headers: {
          'content-length': `${3 * 1024 * 1024 * 1024}`,
        },
      }),
    );

    try {
      await downloadBlob('https://example.com/huge.bin');
      expect.fail('Expected downloadBlob to throw');
    } catch (error) {
      expect(DownloadError.isInstance(error)).toBe(true);
      if (DownloadError.isInstance(error)) {
        expect(error.message).toContain('exceeded maximum size');
      }
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
      await downloadBlob('https://example.com/file.bin', {
        abortSignal: controller.signal,
      });
      expect.fail('Expected downloadBlob to throw');
    } catch (error) {
      expect(DownloadError.isInstance(error)).toBe(true);
    }

    expect(fetch).toHaveBeenCalledWith('https://example.com/file.bin', {
      signal: controller.signal,
      redirect: 'manual',
    });
  });
});

describe('downloadBlob() SSRF protection', () => {
  it('should reject private IPv4 addresses', async () => {
    await expect(downloadBlob('http://127.0.0.1/file')).rejects.toThrow(
      DownloadError,
    );
    await expect(downloadBlob('http://10.0.0.1/file')).rejects.toThrow(
      DownloadError,
    );
    await expect(
      downloadBlob('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toThrow(DownloadError);
  });

  it('should reject localhost', async () => {
    await expect(downloadBlob('http://localhost/file')).rejects.toThrow(
      DownloadError,
    );
  });

  it('should reject non-http protocols', async () => {
    await expect(downloadBlob('file:///etc/passwd')).rejects.toThrow(
      DownloadError,
    );
  });

  it('should reject a redirect to a private IP without requesting it', async () => {
    const originalFetch = globalThis.fetch;
    const onCancel = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createMockStreamResponse({
        ok: false,
        status: 302,
        headers: {
          location: 'http://169.254.169.254/latest/meta-data/',
        },
        body: new TextEncoder().encode('redirecting'),
        onCancel,
      }),
    );
    globalThis.fetch = fetchMock;

    try {
      await expect(downloadBlob('https://evil.com/redirect')).rejects.toThrow(
        DownloadError,
      );
      // The redirect target must never be requested.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('https://evil.com/redirect', {
        signal: undefined,
        redirect: 'manual',
      });
      // Body must be cancelled so the open-redirect rejection does not leak
      // the underlying socket.
      expect(onCancel).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should reject a redirect to localhost without requesting it', async () => {
    const originalFetch = globalThis.fetch;
    const onCancel = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createMockStreamResponse({
        ok: false,
        status: 307,
        headers: { location: 'http://localhost:8080/admin' },
        body: new TextEncoder().encode('redirecting'),
        onCancel,
      }),
    );
    globalThis.fetch = fetchMock;

    try {
      await expect(downloadBlob('https://evil.com/redirect')).rejects.toThrow(
        DownloadError,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should follow redirects to safe URLs', async () => {
    const originalFetch = globalThis.fetch;
    const content = new TextEncoder().encode('safe content');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ location: 'https://cdn.example.com/image.png' }),
        body: null,
      } as unknown as Response)
      .mockResolvedValueOnce(
        createMockStreamResponse({
          body: content,
          headers: { 'content-type': 'image/png' },
        }),
      );
    globalThis.fetch = fetchMock;

    try {
      const result = await downloadBlob('https://example.com/image.png');
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/png');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://cdn.example.com/image.png',
        { signal: undefined, redirect: 'manual' },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should let the browser follow redirects natively on an opaque redirect', async () => {
    // In a browser, `redirect: 'manual'` yields an unreadable opaque-redirect
    // response. SSRF is not reachable from the browser, so we re-issue the
    // request with `redirect: 'follow'` and let the platform follow it.
    const originalFetch = globalThis.fetch;
    const globalThisAny = globalThis as { window?: unknown };
    globalThisAny.window = {};
    const content = new TextEncoder().encode('image bytes');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        type: 'opaqueredirect',
        status: 0,
        ok: false,
        headers: new Headers(),
        body: null,
      } as unknown as Response)
      .mockResolvedValueOnce(
        createMockStreamResponse({
          body: content,
          headers: { 'content-type': 'image/png' },
        }),
      );
    globalThis.fetch = fetchMock;

    try {
      const result = await downloadBlob('https://example.com/image.png');
      expect(result).toBeInstanceOf(Blob);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // First the manual probe, then a native follow of the same URL.
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://example.com/image.png',
        {
          signal: undefined,
          redirect: 'manual',
        },
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://example.com/image.png',
        {
          signal: undefined,
          redirect: 'follow',
        },
      );
    } finally {
      delete globalThisAny.window;
      globalThis.fetch = originalFetch;
    }
  });

  it('should fail closed on an opaque redirect outside the browser', async () => {
    // A spec-compliant server runtime may return an opaque redirect for
    // `redirect: 'manual'`. Since the hop cannot be validated and SSRF is
    // reachable on the server, we must reject rather than follow it natively.
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValueOnce({
      type: 'opaqueredirect',
      status: 0,
      ok: false,
      headers: new Headers(),
      body: null,
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    try {
      await expect(
        downloadBlob('https://example.com/redirect'),
      ).rejects.toThrow(DownloadError);
      // The opaque redirect must not be followed.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should reject relative redirects that resolve to a blocked host', async () => {
    // A redirect Location may be relative; it must be resolved against the
    // current URL and re-validated before being followed.
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: new Headers({ location: 'https://10.0.0.1/internal' }),
      body: null,
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    try {
      await expect(
        downloadBlob('https://example.com/redirect'),
      ).rejects.toThrow(DownloadError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('DownloadError', () => {
  it('should create error with status code and text', () => {
    const error = new DownloadError({
      url: 'https://example.com/test.png',
      statusCode: 403,
      statusText: 'Forbidden',
    });

    expect(error.name).toBe('AI_DownloadError');
    expect(error.url).toBe('https://example.com/test.png');
    expect(error.statusCode).toBe(403);
    expect(error.statusText).toBe('Forbidden');
    expect(error.message).toBe(
      'Failed to download https://example.com/test.png: 403 Forbidden',
    );
  });

  it('should create error with cause', () => {
    const cause = new Error('Connection refused');
    const error = new DownloadError({
      url: 'https://example.com/test.png',
      cause,
    });

    expect(error.url).toBe('https://example.com/test.png');
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('Connection refused');
  });

  it('should create error with custom message', () => {
    const error = new DownloadError({
      url: 'https://example.com/test.png',
      message: 'Custom error message',
    });

    expect(error.message).toBe('Custom error message');
  });

  it('should identify DownloadError instances correctly', () => {
    const downloadError = new DownloadError({
      url: 'https://example.com/test.png',
    });
    const regularError = new Error('Not a download error');

    expect(DownloadError.isInstance(downloadError)).toBe(true);
    expect(DownloadError.isInstance(regularError)).toBe(false);
    expect(DownloadError.isInstance(null)).toBe(false);
    expect(DownloadError.isInstance(undefined)).toBe(false);
  });
});
