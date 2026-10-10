import { injectFetchHeaders } from './inject-fetch-headers';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the version module
vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

// // Mock provider-utils to control runtime environment detection
vi.mock('@ai-sdk/provider-utils', async () => {
  const actual = await vi.importActual('@ai-sdk/provider-utils');
  return {
    ...actual,
    getRuntimeEnvironmentUserAgent: vi.fn(() => 'runtime/testenv'),
  };
});

describe('injectFetchHeaders', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should inject custom headers into fetch request', async () => {
    const mockFetch = vi.fn().mockResolvedValue('response');
    globalThis.fetch = mockFetch;

    const customHeaders = {
      'x-custom-header': 'custom-value',
      authorization: 'Bearer token',
    };

    const enhancedFetch = injectFetchHeaders(customHeaders);
    await enhancedFetch('https://api.example.com');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-custom-header': 'custom-value',
          authorization: 'Bearer token',
          'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
        }),
      }),
    );
  });

  it('should merge custom headers with existing headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue('response');
    globalThis.fetch = mockFetch;

    const customHeaders = {
      'x-custom-header': 'custom-value',
    };

    const existingHeaders = {
      'Content-Type': 'application/json',
    };

    const enhancedFetch = injectFetchHeaders(customHeaders);
    await enhancedFetch('https://api.example.com', {
      headers: existingHeaders,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-custom-header': 'custom-value',
          'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
        }),
      }),
    );
  });

  it('should handle undefined headers in init', async () => {
    const mockFetch = vi.fn().mockResolvedValue('response');
    globalThis.fetch = mockFetch;

    const customHeaders = {
      'x-custom-header': 'custom-value',
    };

    const enhancedFetch = injectFetchHeaders(customHeaders);
    await enhancedFetch('https://api.example.com', {
      headers: undefined,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-custom-header': 'custom-value',
          'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
        }),
      }),
    );
  });

  it('should handle Headers instance in init', async () => {
    const mockFetch = vi.fn().mockResolvedValue('response');
    globalThis.fetch = mockFetch;

    const customHeaders = {
      'x-custom-header': 'custom-value',
    };

    const existingHeaders = new Headers({
      'Content-Type': 'application/json',
    });

    const enhancedFetch = injectFetchHeaders(customHeaders);
    await enhancedFetch('https://api.example.com', {
      headers: existingHeaders,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-custom-header': 'custom-value',
          'user-agent': 'ai-sdk/amazon-bedrock/0.0.0-test runtime/testenv',
        }),
      }),
    );
  });
});
