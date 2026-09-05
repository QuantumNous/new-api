import type { EmbeddingModelV4CallOptions } from '@ai-sdk/provider';
import type { EmbeddingModelMiddleware } from '../types';
import { mergeObjects } from '../util/merge-objects';

/**
 * Applies default settings for an embedding model.
 */
export function defaultEmbeddingSettingsMiddleware({
  settings,
}: {
  settings: Partial<{
    headers?: EmbeddingModelV4CallOptions['headers'];
    providerOptions?: EmbeddingModelV4CallOptions['providerOptions'];
  }>;
}): EmbeddingModelMiddleware {
  return {
    specificationVersion: 'v4',
    transformParams: async ({ params }) => {
      return mergeObjects(settings, params) as EmbeddingModelV4CallOptions;
    },
  };
}
