import { describe, expect, it } from 'vitest';
import { extractLines } from './extract-lines';

describe('extractLines', () => {
  it('returns the input unchanged when neither startLine nor endLine is set', () => {
    expect(extractLines({ text: 'a\nb\nc' })).toBe('a\nb\nc');
  });

  it('slices a 1-based inclusive range from a \\n file', () => {
    expect(extractLines({ text: 'a\nb\nc\nd', startLine: 2, endLine: 3 })).toBe(
      'b\nc',
    );
  });

  it('preserves \\r\\n line endings', () => {
    expect(
      extractLines({ text: 'a\r\nb\r\nc\r\nd', startLine: 2, endLine: 3 }),
    ).toBe('b\r\nc');
  });

  it('preserves \\r line endings', () => {
    expect(extractLines({ text: 'a\rb\rc\rd', startLine: 2, endLine: 3 })).toBe(
      'b\rc',
    );
  });

  it('treats endLine past EOF as the last line', () => {
    expect(extractLines({ text: 'a\nb\nc', startLine: 2, endLine: 99 })).toBe(
      'b\nc',
    );
  });

  it('defaults startLine to 1 when only endLine is set', () => {
    expect(extractLines({ text: 'a\nb\nc', endLine: 2 })).toBe('a\nb');
  });

  it('defaults endLine to the last line when only startLine is set', () => {
    expect(extractLines({ text: 'a\nb\nc', startLine: 2 })).toBe('b\nc');
  });

  it('returns input unchanged when there are no line breaks', () => {
    expect(extractLines({ text: 'one-liner', startLine: 1, endLine: 1 })).toBe(
      'one-liner',
    );
  });
});
