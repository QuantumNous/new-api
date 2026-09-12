import type { ImageModelV4Middleware } from '@ai-sdk/provider';

/**
 * Middleware for image models.
 * Accepts both V3 and V4 middleware types for backward compatibility.
 *
 * Uses ImageModelV4Middleware as the base but relaxes specificationVersion
 * to accept any string (including 'v3') and makes it optional.
 */
export type ImageModelMiddleware = Omit<
  ImageModelV4Middleware,
  'specificationVersion'
> & {
  readonly specificationVersion?: string;
};
