import {
  createSigV4FetchFunction,
  createApiKeyFetchFunction,
} from './amazon-bedrock-sigv4-fetch';
import { vi, describe, it, expect, afterEach } from 'vitest';

// Mock the version module
vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

// Mock provider-utils to control runtime environment detection
vi.mock('@ai-sdk/provider-utils', async () => {
  const actual = await vi.importActual('@ai-sdk/provider-utils');
  return {
    ...actual,
    getRuntimeEnvironmentUserAgent: vi.fn(() => 'runtime/testenv'),
  };
});

// Mock AwsV4Signer so that no real crypto calls are made.
// Capture constructor options for test assertions.
let lastSignerOptions: any = null;
vi.mock('aws4fetch', () => {
  class MockAwsV4Signer {
    options: any;
    constructor(options: any) {
      this.options = options;
      lastSignerOptions = options;
    }
    async sign() {
      // Return a fake Headers instance with predetermined signing headers.
      const headers = new Headers();
      headers.set('x-amz-date', '20240315T000000Z');
      headers.set('authorization', 'AWS4-HMAC-SHA256 Credential=test');
      if (this.options.sessionToken) {
        headers.set('x-amz-security-token', this.options.sessionToken);
      }
      return { headers };
    }
  }
  return { AwsV4Signer: MockAwsV4Signer };
});

const createFetchFunction = (dummyFetch: any) =>
  createSigV4FetchFunction(
    () => ({
      region: 'us-west-2',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret',
    }),
    dummyFetch,
  );

describe('createSigV4FetchFunction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should bypass signing for non-POST requests', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const response = await fetchFn('http://example.com', { method: 'GET' });
    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'GET',
      headers: {
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
    expect(response).toBe(dummyResponse);
  });

  it('should bypass signing if POST request has no body', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const response = await fetchFn('http://example.com', { method: 'POST' });
    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'POST',
      headers: {
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
    expect(response).toBe(dummyResponse);
  });

  it('should handle a POST request with a string body and merge signed headers including user-agent', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);

    // Provide settings (including a sessionToken) so that the signer includes that header.\
    const fetchFn = createSigV4FetchFunction(
      () => ({
        region: 'us-west-2',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-session-token',
      }),
      dummyFetch,
    );

    const inputUrl = 'http://example.com';
    const init: RequestInit = {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'Content-Type': 'application/json',
        'Custom-Header': 'value',
      },
    };

    await fetchFn(inputUrl, init);
    expect(dummyFetch).toHaveBeenCalled();
    const calledInit = dummyFetch.mock.calls[0][1] as RequestInit;
    // `combinedHeaders` should merge the original headers with the signing
    // headers added by the AwsV4Signer mock.
    const headers = calledInit.headers as Record<string, string>;
    expect(headers['content-type']).toEqual('application/json');
    expect(headers['custom-header']).toEqual('value');
    expect(headers['empty-header']).toBeUndefined();
    expect(headers['x-amz-date']).toEqual('20240315T000000Z');
    expect(headers['authorization']).toEqual(
      'AWS4-HMAC-SHA256 Credential=test',
    );
    expect(headers['x-amz-security-token']).toEqual('test-session-token');
    expect(headers['user-agent']).toEqual(
      'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
    );
    // Body is left unmodified for a string body.
    expect(calledInit.body).toEqual('{"test": "data"}');
  });

  it('should handle a POST request with a Request object', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const inputUrl = 'http://example.com';
    const request = new Request(inputUrl, {
      method: 'POST',
      body: '{"test": "data"}',
      headers: { 'X-From-Request': 'from-request' },
    });
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Custom-Header': 'value',
      },
    };
    await fetchFn(request, init);
    expect(dummyFetch).toHaveBeenCalled();
    const calledRequest = dummyFetch.mock.calls[0][0] as Request;
    const calledInit = dummyFetch.mock.calls[0][1] as RequestInit;
    const headers = calledInit.headers as Record<string, string>;
    expect(calledRequest.url).toEqual('http://example.com/');
    expect(calledInit.body).toEqual('{"test": "data"}');
    expect(headers['content-type']).toEqual('application/json');
    expect(headers['custom-header']).toEqual('value');
    expect(headers['x-from-request']).toEqual('from-request');
  });

  it('should sign when input is a POST Request with body and no init', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const request = new Request('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'Content-Type': 'application/json',
        'X-From-Request': 'from-request',
      },
    });

    await fetchFn(request);

    expect(dummyFetch).toHaveBeenCalled();
    const calledInit = dummyFetch.mock.calls[0][1] as RequestInit;
    const headers = calledInit.headers as Record<string, string>;

    expect(calledInit.body).toEqual('{"test": "data"}');
    expect(headers['content-type']).toEqual('application/json');
    expect(headers['x-from-request']).toEqual('from-request');
    expect(headers['x-amz-date']).toEqual('20240315T000000Z');
    expect(headers['authorization']).toEqual(
      'AWS4-HMAC-SHA256 Credential=test',
    );
    expect(headers['user-agent']).toEqual(
      'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
    );
  });

  it('should handle non-string body by stringifying it', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const inputUrl = 'http://example.com';
    const jsonBody = { field: 'value' };

    await fetchFn(inputUrl, {
      method: 'POST',
      body: jsonBody as unknown as BodyInit,
      headers: {},
    });
    expect(dummyFetch).toHaveBeenCalled();
    const calledInit = dummyFetch.mock.calls[0][1] as RequestInit;
    // The body should be stringified.
    expect(calledInit.body).toEqual(JSON.stringify(jsonBody));
  });

  it('should handle Uint8Array body', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const inputUrl = 'http://example.com';
    const uint8Body = new TextEncoder().encode('binaryTest');

    await fetchFn(inputUrl, {
      method: 'POST',
      body: uint8Body,
      headers: {},
    });
    expect(dummyFetch).toHaveBeenCalled();
    const calledInit = dummyFetch.mock.calls[0][1] as RequestInit;
    // The Uint8Array body should have been decoded to a string.
    expect(calledInit.body).toEqual('binaryTest');
  });

  it('should handle ArrayBuffer body', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const inputUrl = 'http://example.com';
    const text = 'bufferTest';
    const buffer = new TextEncoder().encode(text).buffer;

    await fetchFn(inputUrl, {
      method: 'POST',
      body: buffer,
      headers: {},
    });
    expect(dummyFetch).toHaveBeenCalled();
    const calledInit = dummyFetch.mock.calls[0][1] as RequestInit;
    expect(calledInit.body).toEqual(text);
  });

  it('should extract headers from a Headers instance', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const h = new Headers();
    h.set('A', 'value-a');
    h.set('B', 'value-b');

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: h,
    });
    expect(dummyFetch).toHaveBeenCalled();
    const calledInit = dummyFetch.mock.calls[0][1] as RequestInit;
    const headers = calledInit.headers as Record<string, string>;
    expect(headers['a'] || headers['A']).toEqual('value-a');
    expect(headers['b'] || headers['B']).toEqual('value-b');
  });

  it('should handle headers provided as an array', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const headersArray: [string, string][] = [
      ['Array-Header', 'array-value'],
      ['Another-Header', 'another-value'],
    ];

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: headersArray,
    });
    expect(dummyFetch).toHaveBeenCalled();
    const calledInit = dummyFetch.mock.calls[0][1] as RequestInit;
    const headers = calledInit.headers as Record<string, string>;
    expect(headers['array-header'] || headers['Array-Header']).toEqual(
      'array-value',
    );
    expect(headers['another-header'] || headers['Another-Header']).toEqual(
      'another-value',
    );
    // Also check that the signing headers are included.
    expect(headers['x-amz-date']).toEqual('20240315T000000Z');
    expect(headers['authorization']).toEqual(
      'AWS4-HMAC-SHA256 Credential=test',
    );
  });

  it('should call original fetch if init is undefined', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const fetchFn = createFetchFunction(dummyFetch);

    const response = await fetchFn('http://example.com');
    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      headers: {
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
    expect(response).toBe(dummyResponse);
  });

  it('should correctly handle async credential providers', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);

    // Create a function that returns a Promise of credentials
    const asyncCredentialsProvider = () =>
      Promise.resolve({
        region: 'us-east-1',
        accessKeyId: 'async-access-key',
        secretAccessKey: 'async-secret-key',
        sessionToken: 'async-session-token',
      });

    const fetchFn = createSigV4FetchFunction(
      asyncCredentialsProvider,
      dummyFetch,
    );

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "async"}',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Verify the request was properly signed
    expect(dummyFetch).toHaveBeenCalled();
    const calledInit = dummyFetch.mock.calls[0][1] as RequestInit;
    const headers = calledInit.headers as Record<string, string>;

    // Check that the signing headers were added
    expect(headers['x-amz-date']).toEqual('20240315T000000Z');
    expect(headers['authorization']).toEqual(
      'AWS4-HMAC-SHA256 Credential=test',
    );
    expect(headers['x-amz-security-token']).toEqual('async-session-token');
    expect(headers['content-type']).toEqual('application/json');
  });

  it('should handle async credential providers that reject', async () => {
    const dummyFetch = vi.fn();
    const errorMessage = 'Failed to get credentials';

    // Create a function that returns a rejected Promise
    const failingCredentialsProvider = () =>
      Promise.reject(new Error(errorMessage));

    const fetchFn = createSigV4FetchFunction(
      failingCredentialsProvider,
      dummyFetch,
    );

    // The fetch call should propagate the rejection
    await expect(
      fetchFn('http://example.com', {
        method: 'POST',
        body: '{"test": "data"}',
      }),
    ).rejects.toThrow(errorMessage);

    // The underlying fetch should not be called
    expect(dummyFetch).not.toHaveBeenCalled();
  });

  it('should use default service name "bedrock" when no service parameter is provided', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    lastSignerOptions = null;

    const fetchFn = createSigV4FetchFunction(
      () => ({
        region: 'us-west-2',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret',
      }),
      dummyFetch,
    );

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
    });

    expect(lastSignerOptions).not.toBeNull();
    expect(lastSignerOptions.service).toBe('bedrock');
  });

  it('should use custom service name when service parameter is provided', async () => {
    const dummyResponse = new Response('Signed', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    lastSignerOptions = null;

    const fetchFn = createSigV4FetchFunction(
      () => ({
        region: 'us-west-2',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret',
      }),
      dummyFetch,
      'bedrock-mantle',
    );

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
    });

    expect(lastSignerOptions).not.toBeNull();
    expect(lastSignerOptions.service).toBe('bedrock-mantle');
  });
});

describe('createApiKeyFetchFunction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should add Authorization header with Bearer token and user-agent', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = 'test-api-key-123';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    const response = await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer test-api-key-123',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
    expect(response).toBe(dummyResponse);
  });

  it('should merge Authorization header with existing headers', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = 'test-api-key-456';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'Content-Type': 'application/json',
        'Custom-Header': 'custom-value',
        'X-Request-ID': 'req-123',
      },
    });

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'content-type': 'application/json',
        'custom-header': 'custom-value',
        'x-request-id': 'req-123',
        Authorization: 'Bearer test-api-key-456',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
  });

  it('should work with Headers instance', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = 'test-api-key-789';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('X-Custom', 'value');

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers,
    });

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'content-type': 'application/json',
        'x-custom': 'value',
        Authorization: 'Bearer test-api-key-789',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
  });

  it('should work with headers as array', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = 'test-api-key-array';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    const headersArray: [string, string][] = [
      ['Content-Type', 'application/json'],
      ['X-Array-Header', 'array-value'],
    ];

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: headersArray,
    });

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'content-type': 'application/json',
        'x-array-header': 'array-value',
        Authorization: 'Bearer test-api-key-array',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
  });

  it('should work with GET requests', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = 'test-api-key-get';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    await fetchFn('http://example.com', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer test-api-key-get',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
  });

  it('should work when no headers are provided', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = 'test-api-key-no-headers';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
    });

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        Authorization: 'Bearer test-api-key-no-headers',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
  });

  it('should work when init is undefined', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = 'test-api-key-undefined';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    await fetchFn('http://example.com');

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      headers: {
        Authorization: 'Bearer test-api-key-undefined',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
  });

  it('should override existing Authorization header', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = 'test-api-key-override';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer old-token',
      },
    });

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer test-api-key-override',
        authorization: 'Bearer old-token',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
  });

  it('should use default fetch when no custom fetch provided', async () => {
    const originalFetch = globalThis.fetch;
    const mockGlobalFetch = vi.fn().mockResolvedValue(new Response('OK'));
    globalThis.fetch = mockGlobalFetch;

    try {
      const apiKey = 'test-api-key-default';
      const fetchFn = createApiKeyFetchFunction(apiKey);

      await fetchFn('http://example.com', {
        method: 'POST',
        body: '{"test": "data"}',
      });

      expect(mockGlobalFetch).toHaveBeenCalledWith('http://example.com', {
        method: 'POST',
        body: '{"test": "data"}',
        headers: {
          Authorization: 'Bearer test-api-key-default',
          'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should resolve default fetch lazily when no custom fetch provided', async () => {
    const originalFetch = globalThis.fetch;
    const initialFetch = vi.fn().mockResolvedValue(new Response('Initial'));
    const patchedFetch = vi.fn().mockResolvedValue(new Response('Patched'));

    globalThis.fetch = initialFetch;
    const fetchFn = createApiKeyFetchFunction('test-api-key-lazy');
    globalThis.fetch = patchedFetch;

    try {
      await fetchFn('http://example.com', {
        method: 'POST',
        body: '{"test": "data"}',
      });

      expect(initialFetch).not.toHaveBeenCalled();
      expect(patchedFetch).toHaveBeenCalledWith('http://example.com', {
        method: 'POST',
        body: '{"test": "data"}',
        headers: {
          Authorization: 'Bearer test-api-key-lazy',
          'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should handle empty string API key', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = '';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    await fetchFn('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
    });

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'POST',
      body: '{"test": "data"}',
      headers: {
        Authorization: 'Bearer ',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
    });
  });

  it('should preserve request body and other properties', async () => {
    const dummyResponse = new Response('OK', { status: 200 });
    const dummyFetch = vi.fn().mockResolvedValue(dummyResponse);
    const apiKey = 'test-api-key-preserve';

    const fetchFn = createApiKeyFetchFunction(apiKey, dummyFetch);

    const requestBody = JSON.stringify({ data: 'test' });
    await fetchFn('http://example.com', {
      method: 'PUT',
      body: requestBody,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      cache: 'no-cache',
    });

    expect(dummyFetch).toHaveBeenCalledWith('http://example.com', {
      method: 'PUT',
      body: requestBody,
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer test-api-key-preserve',
        'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
      },
      credentials: 'include',
      cache: 'no-cache',
    });
  });
});
