import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './get-error-message';

describe('getErrorMessage', () => {
  describe('null and undefined', () => {
    it('should return "unknown error" for null', () => {
      expect(getErrorMessage(null)).toBe('unknown error');
    });

    it('should return "unknown error" for undefined', () => {
      expect(getErrorMessage(undefined)).toBe('unknown error');
    });
  });

  describe('string errors', () => {
    it('should return the string as-is', () => {
      expect(getErrorMessage('something went wrong')).toBe(
        'something went wrong',
      );
    });

    it('should return an empty string as-is', () => {
      expect(getErrorMessage('')).toBe('');
    });
  });

  describe('Error instances', () => {
    it('should include the Error type prefix for a basic Error', () => {
      expect(getErrorMessage(new Error('API crashed'))).toBe(
        'Error: API crashed',
      );
    });

    it('should include the TypeError prefix', () => {
      expect(getErrorMessage(new TypeError('invalid argument'))).toBe(
        'TypeError: invalid argument',
      );
    });

    it('should include the RangeError prefix', () => {
      expect(getErrorMessage(new RangeError('out of bounds'))).toBe(
        'RangeError: out of bounds',
      );
    });

    it('should return just the error name when message is empty', () => {
      // eslint-disable-next-line unicorn/error-message
      expect(getErrorMessage(new Error(''))).toBe('Error');
    });

    it('should return just the type name when TypeError message is empty', () => {
      // eslint-disable-next-line unicorn/error-message
      expect(getErrorMessage(new TypeError(''))).toBe('TypeError');
    });

    it('should handle custom error subclasses', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      expect(getErrorMessage(new CustomError('custom failure'))).toBe(
        'CustomError: custom failure',
      );
    });

    it('should respect custom toString() overrides', () => {
      class MyApiError extends Error {
        code: number;
        constructor(message: string, code: number) {
          super(message);
          this.name = 'MyApiError';
          this.code = code;
        }
        toString() {
          return `API Error ${this.code}: ${this.message}`;
        }
      }
      expect(getErrorMessage(new MyApiError('rate limited', 429))).toBe(
        'API Error 429: rate limited',
      );
    });

    it('should handle custom error subclass with empty message', () => {
      class CustomError extends Error {
        constructor() {
          super('');
          this.name = 'CustomError';
        }
      }
      expect(getErrorMessage(new CustomError())).toBe('CustomError');
    });
  });

  describe('other types', () => {
    it('should JSON.stringify plain objects', () => {
      expect(getErrorMessage({ code: 'FAIL', detail: 'oops' })).toBe(
        '{"code":"FAIL","detail":"oops"}',
      );
    });

    it('should JSON.stringify numbers', () => {
      expect(getErrorMessage(42)).toBe('42');
    });

    it('should JSON.stringify booleans', () => {
      expect(getErrorMessage(false)).toBe('false');
    });

    it('should JSON.stringify arrays', () => {
      expect(getErrorMessage(['a', 'b'])).toBe('["a","b"]');
    });
  });
});
