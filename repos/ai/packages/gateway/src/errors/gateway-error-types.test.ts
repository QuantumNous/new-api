import { describe, expect, it } from 'vitest';
import {
  GatewayError,
  GatewayAuthenticationError,
  GatewayInvalidRequestError,
  GatewayRateLimitError,
  GatewayModelNotFoundError,
  GatewayInternalServerError,
  GatewayResponseError,
  GatewayTimeoutError,
} from './index';

describe('GatewayAuthenticationError', () => {
  it('should create error with default values', () => {
    const error = new GatewayAuthenticationError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GatewayError);
    expect(error.name).toBe('GatewayAuthenticationError');
    expect(error.type).toBe('authentication_error');
    expect(error.message).toBe('Authentication failed');
    expect(error.statusCode).toBe(401);
    expect(error.cause).toBeUndefined();
  });

  it('should create error with custom values', () => {
    const cause = new Error('Original error');
    const error = new GatewayAuthenticationError({
      message: 'Custom auth failed',
      statusCode: 403,
      cause,
    });

    expect(error.message).toBe('Custom auth failed');
    expect(error.statusCode).toBe(403);
    expect(error.cause).toBe(cause);
  });

  it('should be identifiable via instance check', () => {
    const error = new GatewayAuthenticationError();
    const otherError = new Error('Not a gateway error');

    expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
    expect(GatewayAuthenticationError.isInstance(otherError)).toBe(false);
    expect(GatewayError.isInstance(error)).toBe(true);
  });

  describe('createContextualError', () => {
    it('should create error for invalid API key only', () => {
      const error = GatewayAuthenticationError.createContextualError({
        apiKeyProvided: true,
        oidcTokenProvided: false,
      });

      expect(error.message).toContain('Invalid API key');
      expect(error.message).toContain('vercel.com/d?to=');
      expect(error.statusCode).toBe(401);
    });

    it('should create error for invalid OIDC token only', () => {
      const error = GatewayAuthenticationError.createContextualError({
        apiKeyProvided: false,
        oidcTokenProvided: true,
      });

      expect(error.message).toContain('Invalid OIDC token');
      expect(error.message).toContain('npx vercel link');
      expect(error.statusCode).toBe(401);
    });

    it('should create error for no authentication provided', () => {
      const error = GatewayAuthenticationError.createContextualError({
        apiKeyProvided: false,
        oidcTokenProvided: false,
      });

      expect(error.message).toContain('No authentication provided');
      expect(error.message).toContain('Option 1');
      expect(error.message).toContain('Option 2');
      expect(error.statusCode).toBe(401);
    });

    it('should prioritize API key error when both were provided', () => {
      const error = GatewayAuthenticationError.createContextualError({
        apiKeyProvided: true,
        oidcTokenProvided: true,
      });

      expect(error.message).toContain('Invalid API key');
      expect(error.message).toContain('vercel.com/d?to=');
      expect(error.statusCode).toBe(401);
    });

    it('should create error for neither provided (legacy test)', () => {
      const error = GatewayAuthenticationError.createContextualError({
        apiKeyProvided: false,
        oidcTokenProvided: false,
      });

      expect(error.message).toContain('No authentication provided');
      expect(error.message).toContain('Option 1');
      expect(error.message).toContain('Option 2');
      expect(error.statusCode).toBe(401);
    });
  });
});

describe('GatewayInvalidRequestError', () => {
  it('should create error with default values', () => {
    const error = new GatewayInvalidRequestError();

    expect(error.name).toBe('GatewayInvalidRequestError');
    expect(error.type).toBe('invalid_request_error');
    expect(error.message).toBe('Invalid request');
    expect(error.statusCode).toBe(400);
  });

  it('should create error with custom values', () => {
    const error = new GatewayInvalidRequestError({
      message: 'Missing required field',
      statusCode: 422,
    });

    expect(error.message).toBe('Missing required field');
    expect(error.statusCode).toBe(422);
  });

  it('should be identifiable via instance check', () => {
    const error = new GatewayInvalidRequestError();

    expect(GatewayInvalidRequestError.isInstance(error)).toBe(true);
    expect(GatewayAuthenticationError.isInstance(error)).toBe(false);
    expect(GatewayError.isInstance(error)).toBe(true);
  });
});

describe('GatewayRateLimitError', () => {
  it('should create error with default values', () => {
    const error = new GatewayRateLimitError();

    expect(error.name).toBe('GatewayRateLimitError');
    expect(error.type).toBe('rate_limit_exceeded');
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.statusCode).toBe(429);
  });

  it('should be identifiable via instance check', () => {
    const error = new GatewayRateLimitError();

    expect(GatewayRateLimitError.isInstance(error)).toBe(true);
    expect(GatewayError.isInstance(error)).toBe(true);
  });
});

describe('GatewayModelNotFoundError', () => {
  it('should create error with default values', () => {
    const error = new GatewayModelNotFoundError();

    expect(error.name).toBe('GatewayModelNotFoundError');
    expect(error.type).toBe('model_not_found');
    expect(error.message).toBe('Model not found');
    expect(error.statusCode).toBe(404);
    expect(error.modelId).toBeUndefined();
  });

  it('should create error with model ID', () => {
    const error = new GatewayModelNotFoundError({
      message: 'Model gpt-4 not found',
      modelId: 'gpt-4',
    });

    expect(error.message).toBe('Model gpt-4 not found');
    expect(error.modelId).toBe('gpt-4');
  });

  it('should be identifiable via instance check', () => {
    const error = new GatewayModelNotFoundError();

    expect(GatewayModelNotFoundError.isInstance(error)).toBe(true);
    expect(GatewayError.isInstance(error)).toBe(true);
  });
});

describe('GatewayInternalServerError', () => {
  it('should create error with default values', () => {
    const error = new GatewayInternalServerError();

    expect(error.name).toBe('GatewayInternalServerError');
    expect(error.type).toBe('internal_server_error');
    expect(error.message).toBe('Internal server error');
    expect(error.statusCode).toBe(500);
  });

  it('should be identifiable via instance check', () => {
    const error = new GatewayInternalServerError();

    expect(GatewayInternalServerError.isInstance(error)).toBe(true);
    expect(GatewayError.isInstance(error)).toBe(true);
  });
});

describe('isRetryable', () => {
  it('should be true for GatewayInternalServerError (500)', () => {
    const error = new GatewayInternalServerError();
    expect(error.isRetryable).toBe(true);
  });

  it('should be true for GatewayRateLimitError (429)', () => {
    const error = new GatewayRateLimitError();
    expect(error.isRetryable).toBe(true);
  });

  it('should be true for GatewayTimeoutError (408)', () => {
    const error = new GatewayTimeoutError();
    expect(error.isRetryable).toBe(true);
  });

  it('should be true for status codes >= 500', () => {
    const error = new GatewayInternalServerError({ statusCode: 503 });
    expect(error.isRetryable).toBe(true);
  });

  it('should be false for GatewayAuthenticationError (401)', () => {
    const error = new GatewayAuthenticationError();
    expect(error.isRetryable).toBe(false);
  });

  it('should be false for GatewayInvalidRequestError (400)', () => {
    const error = new GatewayInvalidRequestError();
    expect(error.isRetryable).toBe(false);
  });

  it('should be false for GatewayModelNotFoundError (404)', () => {
    const error = new GatewayModelNotFoundError();
    expect(error.isRetryable).toBe(false);
  });

  it('should be true for GatewayResponseError (502)', () => {
    const error = new GatewayResponseError();
    expect(error.isRetryable).toBe(true);
  });
});

describe('GatewayResponseError', () => {
  it('should create error with default values', () => {
    const error = new GatewayResponseError();

    expect(error.name).toBe('GatewayResponseError');
    expect(error.type).toBe('response_error');
    expect(error.message).toBe('Invalid response from Gateway');
    expect(error.statusCode).toBe(502);
    expect(error.response).toBeUndefined();
    expect(error.validationError).toBeUndefined();
  });

  it('should create error with response and validation error details', () => {
    const response = { invalidField: 'value' };
    const validationError = {
      issues: [{ path: ['error'], message: 'Required' }],
    } as any; // Mock ZodError structure

    const error = new GatewayResponseError({
      message: 'Custom parsing error',
      statusCode: 422,
      response,
      validationError,
    });

    expect(error.message).toBe('Custom parsing error');
    expect(error.statusCode).toBe(422);
    expect(error.response).toBe(response);
    expect(error.validationError).toBe(validationError);
  });

  it('should be identifiable via instance check', () => {
    const error = new GatewayResponseError();

    expect(GatewayResponseError.isInstance(error)).toBe(true);
    expect(GatewayError.isInstance(error)).toBe(true);
  });
});

describe('Cross-realm instance checking', () => {
  it('should work with symbol-based type checking', () => {
    const error = new GatewayAuthenticationError();

    // Simulate different realm by creating a new instance in different context
    const gatewayErrorMarker = Symbol.for('vercel.ai.gateway.error');
    const authErrorMarker = Symbol.for(
      'vercel.ai.gateway.error.GatewayAuthenticationError',
    );

    // Verify the symbols are present
    expect((error as any)[gatewayErrorMarker]).toBe(true);
    expect((error as any)[authErrorMarker]).toBe(true);

    // Test cross-realm safety
    expect(GatewayError.hasMarker(error)).toBe(true);
    expect(GatewayAuthenticationError.isInstance(error)).toBe(true);
  });
});

describe('Error inheritance chain', () => {
  it('should maintain proper inheritance', () => {
    const error = new GatewayAuthenticationError();

    expect(error instanceof Error).toBe(true);
    expect(error instanceof GatewayError).toBe(true);
    expect(error instanceof GatewayAuthenticationError).toBe(true);
  });

  it('should have proper stack traces', () => {
    const error = new GatewayAuthenticationError({
      message: 'Test error',
    });

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('GatewayAuthenticationError');
    expect(error.stack).toContain('Test error');
  });
});
