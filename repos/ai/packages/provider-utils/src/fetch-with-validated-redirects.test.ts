import { afterEach, describe, expect, it, vi } from 'vitest';
import { DownloadError } from './download-error';
import { fetchWithValidatedRedirects } from './fetch-with-validated-redirects';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as { window?: unknown }).window;
});

function redirectResponse(location: string, status = 302): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ location }),
    body: null,
  } as unknown as Response;
}

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/png' }),
    body: null,
  } as unknown as Response;
}

describe('fetchWithValidatedRedirects', () => {
  it('validates the initial URL before requesting it', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    await expect(
      fetchWithValidatedRedirects({ url: 'http://localhost/file' }),
    ).rejects.toThrow(DownloadError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses redirect: manual and omits headers when none are provided', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse());
    globalThis.fetch = fetchMock;

    await fetchWithValidatedRedirects({ url: 'https://example.com/file' });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/file', {
      signal: undefined,
      redirect: 'manual',
    });
  });

  it('follows a redirect to a safe URL, validating the hop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse('https://cdn.example.com/file'))
      .mockResolvedValueOnce(okResponse());
    globalThis.fetch = fetchMock;

    const response = await fetchWithValidatedRedirects({
      url: 'https://example.com/file',
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://cdn.example.com/file',
      {
        signal: undefined,
        redirect: 'manual',
      },
    );
  });

  it('rejects a redirect to a private address without requesting it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse('http://169.254.169.254/'));
    globalThis.fetch = fetchMock;

    await expect(
      fetchWithValidatedRedirects({ url: 'https://evil.com/redirect' }),
    ).rejects.toThrow(DownloadError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancels the redirect response body before moving to the next hop (prevents socket leak)', async () => {
    const onCancel = vi.fn();
    const redirectWithBody = (location: string): Response =>
      ({
        ok: false,
        status: 302,
        headers: new Headers({ location }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('redirecting'));
            controller.close();
          },
          cancel() {
            onCancel();
          },
        }),
      }) as unknown as Response;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectWithBody('https://cdn.example.com/file'))
      .mockResolvedValueOnce(redirectWithBody('http://169.254.169.254/'));
    globalThis.fetch = fetchMock;

    await expect(
      fetchWithValidatedRedirects({ url: 'https://example.com/file' }),
    ).rejects.toThrow(DownloadError);

    // Both the followed hop and the hop rejected by the SSRF guard must have
    // their bodies cancelled so the redirect chain does not leak sockets.
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('resolves relative redirect targets against the current URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse('/internal'))
      .mockResolvedValueOnce(okResponse());
    globalThis.fetch = fetchMock;

    await fetchWithValidatedRedirects({ url: 'https://example.com/start' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/internal',
      { signal: undefined, redirect: 'manual' },
    );
  });

  it('rejects once the redirect limit is exceeded', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(redirectResponse('https://example.com/next'));
    globalThis.fetch = fetchMock;

    await expect(
      fetchWithValidatedRedirects({
        url: 'https://example.com/start',
        maxRedirects: 2,
      }),
    ).rejects.toThrow(DownloadError);
  });

  it('fails closed on an opaque redirect outside the browser', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      type: 'opaqueredirect',
      status: 0,
      ok: false,
      headers: new Headers(),
      body: null,
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    await expect(
      fetchWithValidatedRedirects({ url: 'https://example.com/redirect' }),
    ).rejects.toThrow(DownloadError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows redirects natively on an opaque redirect in the browser', async () => {
    (globalThis as { window?: unknown }).window = {};
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        type: 'opaqueredirect',
        status: 0,
        ok: false,
        headers: new Headers(),
        body: null,
      } as unknown as Response)
      .mockResolvedValueOnce(okResponse());
    globalThis.fetch = fetchMock;

    const response = await fetchWithValidatedRedirects({
      url: 'https://example.com/file',
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.com/file', {
      signal: undefined,
      redirect: 'follow',
    });
  });
});
