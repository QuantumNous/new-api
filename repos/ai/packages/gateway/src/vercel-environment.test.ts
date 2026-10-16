import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getVercelOidcToken, getVercelRequestId } from './vercel-environment';

const SYMBOL_FOR_REQ_CONTEXT = Symbol.for('@vercel/request-context');

describe('getVercelRequestId', () => {
  const originalSymbolValue = (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT];

  beforeEach(() => {
    (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT] = undefined;
  });

  afterEach(() => {
    if (originalSymbolValue) {
      (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT] = originalSymbolValue;
    } else {
      (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT] = undefined;
    }
  });

  it('should get request ID from request headers when available', async () => {
    (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT] = {
      get: () => ({
        headers: {
          'x-vercel-id': 'req_1234567890abcdef',
        },
      }),
    };

    const requestId = await getVercelRequestId();
    expect(requestId).toBe('req_1234567890abcdef');
  });

  it('should return undefined when request ID header is not available', async () => {
    (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT] = {
      get: () => ({ headers: {} }),
    };

    const requestId = await getVercelRequestId();
    expect(requestId).toBeUndefined();
  });

  it('should return undefined when no headers are available', async () => {
    (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT] = {
      get: () => ({}),
    };

    const requestId = await getVercelRequestId();
    expect(requestId).toBeUndefined();
  });

  it('should handle missing request context gracefully', async () => {
    (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT] = undefined;

    const requestId = await getVercelRequestId();
    expect(requestId).toBeUndefined();
  });

  it('should handle missing get method in request context', async () => {
    (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT] = {};

    const requestId = await getVercelRequestId();
    expect(requestId).toBeUndefined();
  });
});
