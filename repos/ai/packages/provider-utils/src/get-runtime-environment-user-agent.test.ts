import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRuntimeEnvironmentUserAgent } from './get-runtime-environment-user-agent';

// Stabilize provider utils version used inside UA string construction
vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

describe('getRuntimeEnvironmentUserAgent', () => {
  it('should return the correct user agent for browsers', () => {
    expect(
      getRuntimeEnvironmentUserAgent({
        window: true,
      }),
    ).toBe('runtime/browser');
  });

  it('should return the correct user agent for test', () => {
    expect(
      getRuntimeEnvironmentUserAgent({
        navigator: {
          userAgent: 'test',
        },
      }),
    ).toBe('runtime/test');
  });

  it('should return the correct user agent for Edge Runtime', () => {
    expect(
      getRuntimeEnvironmentUserAgent({
        EdgeRuntime: true,
      }),
    ).toBe('runtime/vercel-edge');
  });

  it('should return the correct user agent for Node.js', () => {
    expect(
      getRuntimeEnvironmentUserAgent({
        process: {
          versions: { node: 'test' },
          version: 'test',
        },
      }),
    ).toBe('runtime/node.js/test');
  });
});
