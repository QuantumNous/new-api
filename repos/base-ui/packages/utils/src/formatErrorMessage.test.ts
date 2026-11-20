import { expect } from 'vitest';
import formatErrorMessage, { createFormatErrorMessage } from './formatErrorMessage';

describe('formatErrorMessage', () => {
  describe('default export', () => {
    it('formats error message with code only', () => {
      const result = formatErrorMessage(123);
      expect(result).toBe(
        'Base UI error #123; visit https://base-ui.com/production-error?code=123 for the full message.',
      );
    });

    it('formats error message with code and args', () => {
      const result = formatErrorMessage(456, 'arg1', 'arg2');
      expect(result).toBe(
        'Base UI error #456; visit https://base-ui.com/production-error?code=456&args%5B%5D=arg1&args%5B%5D=arg2 for the full message.',
      );
    });
  });

  describe('createFormatErrorMessage', () => {
    it('creates a formatter with custom URL and prefix', () => {
      const customFormatter = createFormatErrorMessage('https://example.com/errors', 'My Library');
      const result = customFormatter(789);
      expect(result).toBe(
        'My Library error #789; visit https://example.com/errors?code=789 for the full message.',
      );
    });

    it('creates a formatter that handles args correctly', () => {
      const customFormatter = createFormatErrorMessage(
        'https://custom.dev/error-page',
        'Custom UI',
      );
      const result = customFormatter(100, 'foo', 'bar');
      expect(result).toBe(
        'Custom UI error #100; visit https://custom.dev/error-page?code=100&args%5B%5D=foo&args%5B%5D=bar for the full message.',
      );
    });

    it('handles special characters in args', () => {
      const customFormatter = createFormatErrorMessage('https://example.com/errors', 'Test');
      const result = customFormatter(1, 'hello world', 'foo&bar');
      expect(result).toBe(
        'Test error #1; visit https://example.com/errors?code=1&args%5B%5D=hello+world&args%5B%5D=foo%26bar for the full message.',
      );
    });
  });
});
