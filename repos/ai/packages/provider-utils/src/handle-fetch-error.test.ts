import { APICallError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { handleFetchError } from './handle-fetch-error';

const testUrl = 'https://api.example.com/v1/chat';
const testRequestBodyValues = { prompt: 'test' };

describe('handleFetchError', () => {
  describe('abort errors', () => {
    it('should return abort error as-is', () => {
      const abortError = new DOMException('Aborted', 'AbortError');

      const result = handleFetchError({
        error: abortError,
        url: testUrl,
        requestBodyValues: testRequestBodyValues,
      });

      expect(result).toBe(abortError);
    });
  });

  describe('node.js fetch errors', () => {
    it('should handle TypeError with "fetch failed" message', () => {
      const cause = new Error('ECONNREFUSED');
      const fetchError = new TypeError('fetch failed');
      (fetchError as any).cause = cause;

      const result = handleFetchError({
        error: fetchError,
        url: testUrl,
        requestBodyValues: testRequestBodyValues,
      });

      expect(APICallError.isInstance(result)).toBe(true);
      expect((result as APICallError).isRetryable).toBe(true);
      expect((result as APICallError).message).toBe(
        'Cannot connect to API: ECONNREFUSED',
      );
    });
  });

  describe('browser fetch errors', () => {
    it('should handle TypeError with "Failed to fetch" message', () => {
      const cause = new Error('Network error');
      const fetchError = new TypeError('Failed to fetch');
      (fetchError as any).cause = cause;

      const result = handleFetchError({
        error: fetchError,
        url: testUrl,
        requestBodyValues: testRequestBodyValues,
      });

      expect(APICallError.isInstance(result)).toBe(true);
      expect((result as APICallError).isRetryable).toBe(true);
    });
  });

  describe('bun fetch errors', () => {
    it('should handle ConnectionRefused error', () => {
      const bunError = new Error(
        'Unable to connect. Is the computer able to access the url?',
      );
      (bunError as any).code = 'ConnectionRefused';

      const result = handleFetchError({
        error: bunError,
        url: testUrl,
        requestBodyValues: testRequestBodyValues,
      });

      expect(APICallError.isInstance(result)).toBe(true);
      expect((result as APICallError).isRetryable).toBe(true);
    });

    it('should handle ConnectionClosed error', () => {
      const bunError = new Error(
        'The socket connection was closed unexpectedly',
      );
      (bunError as any).code = 'ConnectionClosed';

      const result = handleFetchError({
        error: bunError,
        url: testUrl,
        requestBodyValues: testRequestBodyValues,
      });

      expect(APICallError.isInstance(result)).toBe(true);
      expect((result as APICallError).isRetryable).toBe(true);
    });

    it('should handle FailedToOpenSocket error', () => {
      const bunError = new Error('Was there a typo in the url or port?');
      (bunError as any).code = 'FailedToOpenSocket';

      const result = handleFetchError({
        error: bunError,
        url: testUrl,
        requestBodyValues: testRequestBodyValues,
      });

      expect(APICallError.isInstance(result)).toBe(true);
      expect((result as APICallError).isRetryable).toBe(true);
    });

    it('should handle ECONNRESET error', () => {
      const bunError = new Error(
        'Client network socket disconnected before secure TLS connection was established',
      );
      (bunError as any).code = 'ECONNRESET';

      const result = handleFetchError({
        error: bunError,
        url: testUrl,
        requestBodyValues: testRequestBodyValues,
      });

      expect(APICallError.isInstance(result)).toBe(true);
      expect((result as APICallError).isRetryable).toBe(true);
    });
  });

  describe('unknown errors', () => {
    it('should return unknown errors as-is', () => {
      const unknownError = new Error('Something unexpected');

      const result = handleFetchError({
        error: unknownError,
        url: testUrl,
        requestBodyValues: testRequestBodyValues,
      });

      expect(result).toBe(unknownError);
    });
  });
});
