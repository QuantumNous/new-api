import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createGoogleVertexMaas,
  googleVertexMaas,
} from './google-vertex-maas-provider-node';
import { createAuthTokenGenerator } from '../google-vertex-auth-google-auth-library';

const { generateAuthToken } = vi.hoisted(() => ({
  generateAuthToken: vi.fn(),
}));

// Mock the imported modules
vi.mock('../google-vertex-auth-google-auth-library', () => ({
  createAuthTokenGenerator: vi.fn(() => generateAuthToken),
}));

vi.mock('./google-vertex-maas-provider', () => ({
  createGoogleVertexMaas: vi.fn(options => {
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

describe('google-vertex-maas-provider-node', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateAuthToken.mockReset();
  });

  it('should create provider with auth wrapper', async () => {
    const provider = createGoogleVertexMaas({
      project: 'test-project',
    });

    expect(provider).toBeDefined();
    const { createGoogleVertexMaas: baseCreateVertexMaas } = vi.mocked(
      await import('./google-vertex-maas-provider'),
    );
    expect(baseCreateVertexMaas).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'test-project',
        fetch: expect.any(Function),
        headers: undefined,
      }),
    );
  });

  it('should generate auth token and add to request headers', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    global.fetch = mockFetch;

    const provider = createGoogleVertexMaas({
      project: 'test-project',
    });

    const customFetch = (provider as any).fetch;
    expect(customFetch).toBeDefined();

    await customFetch('https://example.com/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(createAuthTokenGenerator).toHaveBeenCalledWith(undefined);
    expect(generateAuthToken).toHaveBeenCalledWith();

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-auth-token',
      },
    });
  });

  it('should pass googleAuthOptions to createAuthTokenGenerator', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    global.fetch = mockFetch;

    const googleAuthOptions = { scopes: ['test-scope'] };
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      googleAuthOptions,
    });

    const customFetch = (provider as any).fetch;
    await customFetch('https://example.com/test', {});

    expect(createAuthTokenGenerator).toHaveBeenCalledWith(googleAuthOptions);
    expect(generateAuthToken).toHaveBeenCalledWith();
  });

  it('should merge custom headers with auth header', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    global.fetch = mockFetch;

    const customHeaders = { 'X-Custom': 'header-value' };
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      headers: customHeaders,
    });

    const customFetch = (provider as any).fetch;
    await customFetch('https://example.com/test', {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/test', {
      headers: {
        'Content-Type': 'application/json',
        'X-Custom': 'header-value',
        Authorization: 'Bearer mock-auth-token',
      },
    });
  });

  it('should use custom fetch when provided', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const customFetch = vi.fn().mockResolvedValue(new Response('{}'));

    const provider = createGoogleVertexMaas({
      project: 'test-project',
      fetch: customFetch,
    });

    const authFetch = (provider as any).fetch;
    await authFetch('https://example.com/test', {});

    expect(customFetch).toHaveBeenCalledWith(
      'https://example.com/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-auth-token',
        }),
      }),
    );
  });

  it('should handle async custom headers', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    global.fetch = mockFetch;

    const asyncHeaders = Promise.resolve({ 'X-Async': 'async-value' });
    const provider = createGoogleVertexMaas({
      project: 'test-project',
      headers: asyncHeaders,
    });

    const customFetch = (provider as any).fetch;
    await customFetch('https://example.com/test', {});

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Async': 'async-value',
          Authorization: 'Bearer mock-auth-token',
        }),
      }),
    );
  });

  it('should preserve headers from init parameter', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    global.fetch = mockFetch;

    const provider = createGoogleVertexMaas({
      project: 'test-project',
    });

    const customFetch = (provider as any).fetch;
    await customFetch('https://example.com/test', {
      headers: {
        'User-Agent': 'test-agent',
        'X-Request-ID': 'test-id',
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/test',
      expect.objectContaining({
        headers: {
          'User-Agent': 'test-agent',
          'X-Request-ID': 'test-id',
          Authorization: 'Bearer mock-auth-token',
        },
      }),
    );
  });

  it('should export default googleVertexMaas instance', () => {
    expect(googleVertexMaas).toBeDefined();
    expect(typeof googleVertexMaas).toBe('function');
  });

  it('creates the auth token generator once per provider instance', async () => {
    vi.mocked(generateAuthToken).mockResolvedValue('mock-auth-token');
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    global.fetch = mockFetch;

    const provider = createGoogleVertexMaas({
      project: 'test-project',
    });

    expect(createAuthTokenGenerator).toHaveBeenCalledTimes(1);

    const customFetch = (provider as any).fetch;
    await customFetch('https://example.com/test-1', {});
    await customFetch('https://example.com/test-2', {});

    expect(createAuthTokenGenerator).toHaveBeenCalledTimes(1);
    expect(generateAuthToken).toHaveBeenCalledTimes(2);
  });

  it('should set headers to undefined in base provider call', async () => {
    createGoogleVertexMaas({
      project: 'test-project',
      headers: { 'X-Custom': 'value' },
    });

    const { createGoogleVertexMaas: baseCreateVertexMaas } = vi.mocked(
      await import('./google-vertex-maas-provider'),
    );
    expect(baseCreateVertexMaas).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: undefined,
      }),
    );
  });
});
