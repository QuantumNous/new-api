import { describe, expect, it } from 'vitest';

import { isProviderReference } from './is-provider-reference';

describe('isProviderReference', () => {
  it('returns true for a plain record of provider ids', () => {
    expect(isProviderReference({ openai: 'file-abc123' })).toBe(true);
  });

  it('returns true for a record with a single fileId-like key', () => {
    expect(isProviderReference({ fileId: 'abc' })).toBe(true);
  });

  it('returns false for an object carrying a type property (tagged reference)', () => {
    expect(
      isProviderReference({
        type: 'reference',
        reference: { fileId: 'abc' },
      } as never),
    ).toBe(false);
  });

  it('returns false for a tagged data object with type: "data"', () => {
    expect(isProviderReference({ type: 'data', data: 'x' } as never)).toBe(
      false,
    );
  });

  it('returns false for a Uint8Array', () => {
    expect(isProviderReference(new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('returns false for a URL instance', () => {
    expect(isProviderReference(new URL('https://example.com/file'))).toBe(
      false,
    );
  });

  it('returns false for null', () => {
    expect(isProviderReference(null as never)).toBe(false);
  });

  it('returns false for a string primitive', () => {
    expect(isProviderReference('some-string' as never)).toBe(false);
  });

  it('returns false for a number primitive', () => {
    expect(isProviderReference(42 as never)).toBe(false);
  });
});
