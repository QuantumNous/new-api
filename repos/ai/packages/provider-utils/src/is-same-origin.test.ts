import { describe, it, expect } from 'vitest';
import { isSameOrigin } from './is-same-origin';

describe('isSameOrigin', () => {
  it('returns true for identical origins (ignoring path/query)', () => {
    expect(
      isSameOrigin(
        'https://api.example.com/v1/file',
        'https://api.example.com',
      ),
    ).toBe(true);
    expect(
      isSameOrigin(
        'https://api.example.com/a?x=1',
        'https://api.example.com/b',
      ),
    ).toBe(true);
  });

  it('returns false for a different host', () => {
    expect(
      isSameOrigin('https://cdn.evil.com/file', 'https://api.example.com'),
    ).toBe(false);
  });

  it('returns false for a different scheme or port', () => {
    expect(
      isSameOrigin('http://api.example.com/file', 'https://api.example.com'),
    ).toBe(false);
    expect(
      isSameOrigin(
        'https://api.example.com:8443/file',
        'https://api.example.com',
      ),
    ).toBe(false);
  });

  it('fails closed on invalid input', () => {
    expect(isSameOrigin('not-a-url', 'https://api.example.com')).toBe(false);
    expect(isSameOrigin('https://api.example.com/file', 'not-a-url')).toBe(
      false,
    );
  });
});
