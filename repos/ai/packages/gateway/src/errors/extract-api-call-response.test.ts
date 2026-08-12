import { describe, expect, it } from 'vitest';
import { APICallError } from '@ai-sdk/provider';
import { extractApiCallResponse } from './extract-api-call-response';

describe('extractResponseFromAPICallError', () => {
  describe('when error.data is available', () => {
    it('should return error.data when successfully parsed by AI SDK', () => {
      const parsedData = {
        error: { message: 'Parsed error', type: 'authentication_error' },
      };
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 401,
        data: parsedData,
        responseHeaders: {},
        responseBody: JSON.stringify({ different: 'data' }),
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toBe(parsedData); // Should prefer parsed data over responseBody
    });

    it('should return error.data even when it is null', () => {
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 500,
        data: null,
        responseHeaders: {},
        responseBody: '{"fallback": "data"}',
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toBeNull(); // Should return null, not fallback to responseBody
    });

    it('should return error.data even when it is an empty object', () => {
      const emptyData = {};
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 400,
        data: emptyData,
        responseHeaders: {},
        responseBody: '{"fallback": "data"}',
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toBe(emptyData); // Should return empty object, not fallback
    });
  });

  describe('when error.data is undefined', () => {
    it('should parse and return responseBody as JSON when valid', () => {
      const responseData = {
        ferror: { message: 'Malformed error', type: 'model_not_found' },
      };
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 404,
        data: undefined,
        responseHeaders: {},
        responseBody: JSON.stringify(responseData),
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toEqual(responseData);
    });

    it('should return raw responseBody when JSON parsing fails', () => {
      const invalidJson = 'This is not valid JSON';
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 500,
        data: undefined,
        responseHeaders: {},
        responseBody: invalidJson,
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toBe(invalidJson);
    });

    it('should handle HTML error responses', () => {
      const htmlResponse =
        '<html><body><h1>500 Internal Server Error</h1></body></html>';
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 500,
        data: undefined,
        responseHeaders: {},
        responseBody: htmlResponse,
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toBe(htmlResponse);
    });

    it('should handle empty string responseBody', () => {
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 502,
        data: undefined,
        responseHeaders: {},
        responseBody: '',
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toBe('');
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"incomplete": json';
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 500,
        data: undefined,
        responseHeaders: {},
        responseBody: malformedJson,
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toBe(malformedJson); // Should return raw string, not throw
    });

    it('should parse complex nested JSON structures', () => {
      const complexData = {
        error: {
          message: 'Complex error',
          type: 'validation_error',
          details: {
            field: 'prompt',
            issues: [
              { code: 'too_long', message: 'Prompt exceeds maximum length' },
              {
                code: 'invalid_format',
                message: 'Contains invalid characters',
              },
            ],
          },
        },
        metadata: {
          requestId: '12345',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 400,
        data: undefined,
        responseHeaders: {},
        responseBody: JSON.stringify(complexData),
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toEqual(complexData);
    });
  });

  describe('when responseBody is not available', () => {
    it('should return empty object when both data and responseBody are undefined', () => {
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 500,
        data: undefined,
        responseHeaders: {},
        responseBody: undefined as any, // Simulating missing responseBody
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toEqual({});
    });

    it('should return empty object when responseBody is null', () => {
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 500,
        data: undefined,
        responseHeaders: {},
        responseBody: null as any,
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toEqual({});
    });
  });

  describe('edge cases', () => {
    it('should handle numeric responseBody', () => {
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 500,
        data: undefined,
        responseHeaders: {},
        responseBody: '404',
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toBe(404); // Should parse as number
    });

    it('should handle boolean responseBody', () => {
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 500,
        data: undefined,
        responseHeaders: {},
        responseBody: 'true',
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toBe(true); // Should parse as boolean
    });

    it('should handle array responseBody', () => {
      const arrayData = ['error1', 'error2', 'error3'];
      const apiCallError = new APICallError({
        message: 'Request failed',
        statusCode: 400,
        data: undefined,
        responseHeaders: {},
        responseBody: JSON.stringify(arrayData),
        url: 'http://test.url',
        requestBodyValues: {},
      });

      const result = extractApiCallResponse(apiCallError);

      expect(result).toEqual(arrayData);
    });
  });
});
