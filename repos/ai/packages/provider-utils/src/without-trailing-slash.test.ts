import { describe, expect, it } from 'vitest';
import { withoutTrailingSlash } from './without-trailing-slash';

describe('withoutTrailingSlash', () => {
  it('removes a trailing slash', () => {
    expect(withoutTrailingSlash('https://example.com/')).toBe(
      'https://example.com',
    );
  });

  it('returns undefined when the URL is undefined', () => {
    expect(withoutTrailingSlash(undefined)).toBeUndefined();
  });

  it('preserves an empty string', () => {
    expect(withoutTrailingSlash('')).toBe('');
  });
});
