import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createGoogleVertexXai,
  googleVertexXai,
} from './google-vertex-xai-provider-node';
import { createAuthTokenGenerator } from '../google-vertex-auth-google-auth-library';

const { generateAuthToken } = vi.hoisted(() => ({
  generateAuthToken: vi.fn(),
}));

vi.mock('../google-vertex-auth-google-auth-library', () => ({
  createAuthTokenGenerator: vi.fn(() => generateAuthToken),
}));

vi.mock('./google-vertex-xai-provider', () => ({
  createGoogleVertexXai: vi.fn(options => {
    const provider: any = vi.fn();
    provider.fetch = options.fetch;
    provider.headers = options.headers;
    return provider;
  }),
}));

vi.mock('@ai-sdk/provider-utils', () => ({
  resolve: vi.fn().mockImplementation(async value => {
    if (typeof value === 'function') return value();
    return value;
  }),
}));

describe('google-vertex-xai-provider-node', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateAuthToken.mockReset();
  });

  it('should create provider with auth wrapper', async () => {
    const provider = createGoogleVertexXai({
      project: 'test-project',
    });

    expect(provider).toBeDefined();
    const { createGoogleVertexXai: baseCreateGoogleVertexXai } = vi.mocked(
      await import('./google-vertex-xai-provider'),
    );
    expect(baseCreateGoogleVertexXai).toHaveBeenCalledTimes(1);
    expect(baseCreateGoogleVertexXai.mock.calls[0][0]).toMatchInlineSnapshot(`
      {
        "fetch": [Function],
        "headers": undefined,
        "project": "test-project",
      }
    `);
  });

  it('should generate auth token and add to request headers', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    global.fetch = mockFetch;

    const provider = createGoogleVertexXai({
      project: 'test-project',
    });

    const customFetch = (provider as any).fetch;
    expect(customFetch).toBeDefined();

    await customFetch('https://example.com/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(createAuthTokenGenerator).toHaveBeenCalledWith(undefined);
    expect(generateAuthToken.mock.calls).toEqual([[]]);

    expect(mockFetch.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "https://example.com/test",
          {
            "headers": {
              "Authorization": "Bearer mock-auth-token",
              "Content-Type": "application/json",
            },
            "method": "POST",
          },
        ],
      ]
    `);
  });

  it('should pass googleAuthOptions to createAuthTokenGenerator', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    global.fetch = mockFetch;

    const googleAuthOptions = { scopes: ['test-scope'] };
    const provider = createGoogleVertexXai({
      project: 'test-project',
      googleAuthOptions,
    });

    const customFetch = (provider as any).fetch;
    await customFetch('https://example.com/test', {});

    expect(createAuthTokenGenerator).toHaveBeenCalledWith(googleAuthOptions);
    expect(generateAuthToken.mock.calls).toEqual([[]]);
  });

  it('should merge custom headers with auth header', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    global.fetch = mockFetch;

    const customHeaders = { 'X-Custom': 'header-value' };
    const provider = createGoogleVertexXai({
      project: 'test-project',
      headers: customHeaders,
    });

    const customFetch = (provider as any).fetch;
    await customFetch('https://example.com/test', {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(mockFetch.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "https://example.com/test",
          {
            "headers": {
              "Authorization": "Bearer mock-auth-token",
              "Content-Type": "application/json",
              "X-Custom": "header-value",
            },
          },
        ],
      ]
    `);
  });

  it('should use custom fetch when provided', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const customFetch = vi.fn().mockResolvedValue(new Response('{}'));

    const provider = createGoogleVertexXai({
      project: 'test-project',
      fetch: customFetch,
    });

    const authFetch = (provider as any).fetch;
    await authFetch('https://example.com/test', {});

    expect(customFetch.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "https://example.com/test",
          {
            "headers": {
              "Authorization": "Bearer mock-auth-token",
            },
          },
        ],
      ]
    `);
  });

  it('should export default googleVertexXai instance', () => {
    expect(googleVertexXai).toBeDefined();
    expect(typeof googleVertexXai).toBe('function');
  });
});
