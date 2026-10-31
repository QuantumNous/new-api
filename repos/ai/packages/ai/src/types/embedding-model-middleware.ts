import type { EmbeddingModelV4Middleware } from '@ai-sdk/provider';

/**
 * Middleware for embedding models.
 * Accepts both V3 and V4 middleware types for backward compatibility.
 *
 * Uses EmbeddingModelV4Middleware as the base but relaxes specificationVersion
 * to accept any string (including 'v3') and makes it optional.
 */
export type EmbeddingModelMiddleware = Omit<
  EmbeddingModelV4Middleware,
  'specificationVersion'
> & {
  readonly specificationVersion?: string;
};
