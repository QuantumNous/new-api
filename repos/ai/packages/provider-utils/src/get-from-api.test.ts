import { APICallError } from '@ai-sdk/provider';
import { describe, it, expect, vi } from 'vitest';
import { DownloadError } from './download-error';
import { getFromApi } from './get-from-api';
import {
  createJsonResponseHandler,
  createStatusCodeErrorResponseHandler,
} from './response-handler';
import { z } from 'zod/v4';
import { getRuntimeEnvironmentUserAgent } from './get-runtime-environment-user-agent';
import { withUserAgentSuffix } from './with-user-agent-suffix';

vi.mock('./get-runtime-environment-user-agent', async () => {
  const actual = await vi.importActual('./get-runtime-environment-user-agent');
  return {
    ...actual,
    getRuntimeEnvironmentUserAgent: () => 'runtime/test-env',
  };
});

describe('getFromApi', () => {
  const mockSuccessResponse = {
    name: 'test',
    value: 123,
  };

  const mockResponseSchema = z.object({
    name: z.string(),
    value: z.number(),
  });

  const mockHeaders = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer test',
    'user-agent': 'runtime/test-env',
  };

  it('should successfully fetch and parse data', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockSuccessResponse), {
        status: 200,
        headers: withUserAgentSuffix(
          mockHeaders,
          getRuntimeEnvironmentUserAgent(),
        ),
      }),
    );

    const result = await getFromApi({
      url: 'https://api.test.com/data',
      validateUrl: false,
      headers: { Authorization: 'Bearer test' },
      successfulResponseHandler: createJsonResponseHandler(mockResponseSchema),
      failedResponseHandler: createStatusCodeErrorResponseHandler(),
      fetch: mockFetch,
    });

    expect(result.value).toEqual(mockSuccessResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/data',
      expect.objectContaining({
        method: 'GET',
        headers: {
          authorization: 'Bearer test',
          'user-agent': 'ai-sdk/provider-utils/0.0.0-test runtime/test-env',
        },
      }),
    );
  });

  it('should handle API errors', async () => {
    const errorResponse = { error: 'Not Found' };
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorResponse), {
        status: 404,
        statusText: 'Not Found',
        headers: mockHeaders,
      }),
    );

    await expect(
      getFromApi({
        url: 'https://api.test.com/data',
        validateUrl: false,
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      }),
    ).rejects.toThrow(APICallError);
  });

  it('should handle network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: new Error('Failed to connect'),
      }),
    );

    await expect(
      getFromApi({
        url: 'https://api.test.com/data',
        validateUrl: false,
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      }),
    ).rejects.toThrow('Cannot connect to API: Failed to connect');
  });

  it('should handle abort signals', async () => {
    const abortController = new AbortController();
    const mockFetch = vi.fn().mockImplementation(() => {
      abortController.abort();
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });

    await expect(
      getFromApi({
        url: 'https://api.test.com/data',
        validateUrl: false,
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
        abortSignal: abortController.signal,
      }),
    ).rejects.toThrow('Aborted');
  });

  it('should remove undefined header entries', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockSuccessResponse), {
        status: 200,
        headers: mockHeaders,
      }),
    );

    await getFromApi({
      url: 'https://api.test.com/data',
      validateUrl: false,
      headers: {
        Authorization: 'Bearer test',
        'X-Custom-Header': undefined,
      },
      successfulResponseHandler: createJsonResponseHandler(mockResponseSchema),
      failedResponseHandler: createStatusCodeErrorResponseHandler(),
      fetch: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/data',
      expect.objectContaining({
        headers: {
          authorization: 'Bearer test',
          'user-agent': 'ai-sdk/provider-utils/0.0.0-test runtime/test-env',
        },
      }),
    );
  });

  it('should handle errors in response handlers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('invalid json', {
        status: 200,
        headers: mockHeaders,
      }),
    );

    await expect(
      getFromApi({
        url: 'https://api.test.com/data',
        validateUrl: false,
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      }),
    ).rejects.toThrow(APICallError);
  });

  it('should use default fetch when not provided', async () => {
    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockSuccessResponse), {
        status: 200,
        headers: mockHeaders,
      }),
    );
    global.fetch = mockFetch;

    try {
      await getFromApi({
        url: 'https://api.test.com/data',
        validateUrl: false,
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
      });

      expect(mockFetch).toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  describe('validateUrl', () => {
    const okJson = () =>
      new Response(JSON.stringify(mockSuccessResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const redirectTo = (location: string): Response =>
      ({
        ok: false,
        type: 'default',
        status: 302,
        headers: new Headers({ location }),
        body: null,
      }) as unknown as Response;

    it.each([
      ['loopback', 'http://127.0.0.1/file'],
      ['link-local / metadata', 'http://169.254.169.254/latest/meta-data/'],
      ['private RFC1918', 'http://10.0.0.1/file'],
    ])('rejects a %s URL without fetching it', async (_label, url) => {
      const mockFetch = vi.fn();

      await expect(
        getFromApi({
          url,
          validateUrl: true,
          successfulResponseHandler:
            createJsonResponseHandler(mockResponseSchema),
          failedResponseHandler: createStatusCodeErrorResponseHandler(),
          fetch: mockFetch,
        }),
      ).rejects.toThrow(DownloadError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches and returns a public URL as before', async () => {
      const mockFetch = vi.fn().mockResolvedValue(okJson());

      const result = await getFromApi({
        url: 'https://cdn.example.com/image.png',
        validateUrl: true,
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      });

      expect(result.value).toEqual(mockSuccessResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.example.com/image.png',
        expect.objectContaining({ redirect: 'manual' }),
      );
    });

    it('rejects a redirect to an internal address without following it', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(redirectTo('http://169.254.169.254/'));

      await expect(
        getFromApi({
          url: 'https://cdn.example.com/image.png',
          validateUrl: true,
          successfulResponseHandler:
            createJsonResponseHandler(mockResponseSchema),
          failedResponseHandler: createStatusCodeErrorResponseHandler(),
          fetch: mockFetch,
        }),
      ).rejects.toThrow(DownloadError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('strips forwarding, metadata, and cookie headers from the request', async () => {
      const mockFetch = vi.fn().mockResolvedValue(okJson());

      await getFromApi({
        url: 'https://cdn.example.com/image.png',
        validateUrl: true,
        headers: {
          authorization: 'Bearer secret',
          'metadata-flavor': 'Google',
          'x-forwarded-for': '10.0.0.1',
          cookie: 'session=abc',
        },
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      });

      const sentHeaders = mockFetch.mock.calls[0][1].headers as Headers;
      expect(sentHeaders.get('metadata-flavor')).toBeNull();
      expect(sentHeaders.get('x-forwarded-for')).toBeNull();
      expect(sentHeaders.get('cookie')).toBeNull();
      // Authorization and user-agent are preserved on the initial hop.
      expect(sentHeaders.get('authorization')).toBe('Bearer secret');
      expect(sentHeaders.get('user-agent')).toContain('ai-sdk/provider-utils');
    });

    it('drops all caller headers except user-agent when a redirect crosses origin', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(redirectTo('https://other.example.net/asset'))
        .mockResolvedValueOnce(okJson());

      await getFromApi({
        url: 'https://cdn.example.com/image.png',
        validateUrl: true,
        headers: {
          authorization: 'Bearer secret',
          'x-key': 'provider-api-key',
        },
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      });

      const secondHopHeaders = mockFetch.mock.calls[1][1].headers as Headers;
      expect(secondHopHeaders.get('authorization')).toBeNull();
      expect(secondHopHeaders.get('x-key')).toBeNull();
      // the user-agent suffix still identifies the SDK on the redirected hop.
      expect(secondHopHeaders.get('user-agent')).toContain(
        'ai-sdk/provider-utils',
      );
    });

    it('fetches a private URL when it is same-origin with trustedOrigin (self-hosted deployments)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(okJson());

      const result = await getFromApi({
        url: 'http://localhost:5000/predictions/123',
        validateUrl: true,
        trustedOrigin: 'http://localhost:5000',
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      });

      expect(result.value).toEqual(mockSuccessResponse);
    });

    it('still rejects a private URL on a different origin than trustedOrigin', async () => {
      const mockFetch = vi.fn();

      await expect(
        getFromApi({
          url: 'http://169.254.169.254/latest/meta-data/',
          validateUrl: true,
          trustedOrigin: 'http://localhost:5000',
          successfulResponseHandler:
            createJsonResponseHandler(mockResponseSchema),
          failedResponseHandler: createStatusCodeErrorResponseHandler(),
          fetch: mockFetch,
        }),
      ).rejects.toThrow(DownloadError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not validate the URL when validateUrl is omitted (backwards compatibility)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(okJson());

      // oxlint-disable-next-line ai-sdk/require-validate-url -- deliberately omitted: this test pins the backwards-compatible default
      await getFromApi({
        url: 'http://127.0.0.1/file',
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1/file',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('does not validate the URL when validateUrl is false', async () => {
      const mockFetch = vi.fn().mockResolvedValue(okJson());

      await getFromApi({
        url: 'http://127.0.0.1/file',
        validateUrl: false,
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1/file',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('withholds headers when the URL is not same-origin with credentialedOrigin', async () => {
      const mockFetch = vi.fn().mockResolvedValue(okJson());

      await getFromApi({
        url: 'https://cdn.example.com/image.png',
        validateUrl: true,
        credentialedOrigin: 'https://api.example.com',
        headers: { authorization: 'Bearer secret' },
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      });

      const sent = mockFetch.mock.calls[0][1].headers as Headers;
      expect(sent.get('authorization')).toBeNull();
      // user-agent is still applied even when caller headers are withheld.
      expect(sent.get('user-agent')).toContain('ai-sdk/provider-utils');
    });

    it('sends headers when the URL is same-origin with credentialedOrigin', async () => {
      const mockFetch = vi.fn().mockResolvedValue(okJson());

      await getFromApi({
        url: 'https://api.example.com/poll/123',
        validateUrl: true,
        credentialedOrigin: 'https://api.example.com',
        headers: { authorization: 'Bearer secret' },
        successfulResponseHandler:
          createJsonResponseHandler(mockResponseSchema),
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        fetch: mockFetch,
      });

      const sent = mockFetch.mock.calls[0][1].headers as Headers;
      expect(sent.get('authorization')).toBe('Bearer secret');
    });
  });
});
