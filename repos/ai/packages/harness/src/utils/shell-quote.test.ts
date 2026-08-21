import { describe, expect, it } from 'vitest';
import { shellQuote } from './shell-quote';

describe('shellQuote', () => {
  it('wraps values in single quotes', () => {
    expect(shellQuote('hello')).toBe(`'hello'`);
  });

  it('escapes embedded single quotes', () => {
    expect(shellQuote(`it's`)).toBe(`'it'\\''s'`);
  });

  it('handles empty strings', () => {
    expect(shellQuote('')).toBe(`''`);
  });
});
