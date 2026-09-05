import { describe, expect, it } from 'vitest';
import { canonicalJSON, hashCanonical } from './canonical-hash';

describe('canonicalJSON', () => {
  it('is independent of key insertion order', () => {
    expect(canonicalJSON({ a: 1, b: 2 })).toBe(canonicalJSON({ b: 2, a: 1 }));
  });

  it('sorts keys recursively', () => {
    expect(canonicalJSON({ b: { y: 1, x: 2 }, a: [3, { d: 1, c: 2 }] })).toBe(
      '{"a":[3,{"c":2,"d":1}],"b":{"x":2,"y":1}}',
    );
  });

  it('serializes primitives and null/undefined', () => {
    expect(canonicalJSON(null)).toBe('null');
    expect(canonicalJSON(undefined)).toBe(undefined);
    expect(canonicalJSON('x')).toBe('"x"');
    expect(canonicalJSON(42)).toBe('42');
  });
});

describe('hashCanonical', () => {
  it('produces a stable base64url digest', async () => {
    const digest = await hashCanonical({ a: 1, b: 2 });
    expect(digest).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await hashCanonical({ a: 1, b: 2 })).toBe(digest);
  });

  it('is independent of key order', async () => {
    expect(await hashCanonical({ a: 1, b: 2 })).toBe(
      await hashCanonical({ b: 2, a: 1 }),
    );
  });

  it('changes when the value changes', async () => {
    expect(await hashCanonical({ a: 1 })).not.toBe(
      await hashCanonical({ a: 2 }),
    );
  });
});
