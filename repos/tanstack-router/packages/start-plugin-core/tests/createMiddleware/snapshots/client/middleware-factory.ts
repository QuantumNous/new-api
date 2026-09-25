import { createMiddleware } from '@tanstack/react-start';

// Middleware factory function - returns a middleware with .server() call
export function createPublicRateLimitMiddleware(keySuffix) {
  return createMiddleware({
    type: 'function'
  });
}

// Arrow function factory
export const createAuthMiddleware = requiredRole => {
  return createMiddleware({
    type: 'function'
  });
};

// Top-level middleware for comparison
export const topLevelMiddleware = createMiddleware({
  id: 'topLevel'
});