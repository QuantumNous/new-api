import { describe, expect, it, vi } from 'vitest';
import { httpPolicyClient } from './http-policy-client';

// Simulate the peer dep being absent: any dynamic import of
// '@open-policy-agent/opa' is intercepted and rejected so the lazy-import
// fallback path in the client fires.
vi.mock('@open-policy-agent/opa', () => {
  throw new Error('intentional test failure: module unresolved');
});

describe('httpPolicyClient', () => {
  it('throws a clear install-as-peer-dep error when @open-policy-agent/opa is absent', async () => {
    const client = httpPolicyClient({ url: 'http://localhost:8181' });

    await expect(client.evaluate('p', {})).rejects.toThrow(
      /Cannot import "@open-policy-agent\/opa"\. Install it as a peer dependency/,
    );
  });

  it('attaches the underlying import error as `cause` (ES2018-safe)', async () => {
    const client = httpPolicyClient({ url: 'http://localhost:8181' });

    try {
      await client.evaluate('p', {});
      throw new Error('should have rejected');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error & { cause?: unknown }).cause).toBeDefined();
    }
  });

  it('only attempts the import lazily (constructor does not throw)', () => {
    expect(() =>
      httpPolicyClient({
        url: 'http://localhost:8181',
        headers: { Authorization: 'Bearer x' },
      }),
    ).not.toThrow();
  });
});
