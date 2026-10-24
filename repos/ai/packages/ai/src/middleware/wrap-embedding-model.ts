import type {
  EmbeddingModelV3,
  EmbeddingModelV4,
  EmbeddingModelV4CallOptions,
  EmbeddingModelV4Result,
} from '@ai-sdk/provider';
import { asArray } from '@ai-sdk/provider-utils';
import { asEmbeddingModelV4 } from '../model/as-embedding-model-v4';
import type { EmbeddingModelMiddleware } from '../types';

/**
 * Wraps an EmbeddingModelV4 instance with middleware functionality.
 * This function allows you to apply middleware to transform parameters,
 * wrap embed operations of an embedding model.
 *
 * @param options - Configuration options for wrapping the embedding model.
 * @param options.model - The original EmbeddingModelV4 instance to be wrapped.
 * @param options.middleware - The middleware to be applied to the embedding model. When multiple middlewares are provided, the first middleware will transform the input first, and the last middleware will be wrapped directly around the model.
 * @param options.modelId - Optional custom model ID to override the original model's ID.
 * @param options.providerId - Optional custom provider ID to override the original model's provider ID.
 * @returns A new EmbeddingModelV4 instance with middleware applied.
 */
export const wrapEmbeddingModel = ({
  model: inputModel,
  middleware: middlewareArg,
  modelId,
  providerId,
}: {
  model: EmbeddingModelV3 | EmbeddingModelV4;
  middleware: EmbeddingModelMiddleware | EmbeddingModelMiddleware[];
  modelId?: string;
  providerId?: string;
}): EmbeddingModelV4 => {
  const model = asEmbeddingModelV4(inputModel);
  return [...asArray(middlewareArg)]
    .reverse()
    .reduce((wrappedModel, middleware) => {
      return doWrap({ model: wrappedModel, middleware, modelId, providerId });
    }, model);
};

const doWrap = ({
  model,
  middleware: {
    transformParams,
    wrapEmbed,
    overrideProvider,
    overrideModelId,
    overrideMaxEmbeddingsPerCall,
    overrideSupportsParallelCalls,
  },
  modelId,
  providerId,
}: {
  model: EmbeddingModelV4;
  middleware: EmbeddingModelMiddleware;
  modelId?: string;
  providerId?: string;
}): EmbeddingModelV4 => {
  async function doTransform({
    params,
  }: {
    params: EmbeddingModelV4CallOptions;
  }) {
    return transformParams ? await transformParams({ params, model }) : params;
  }

  return {
    specificationVersion: 'v4',
    provider: providerId ?? overrideProvider?.({ model }) ?? model.provider,
    modelId: modelId ?? overrideModelId?.({ model }) ?? model.modelId,
    maxEmbeddingsPerCall:
      overrideMaxEmbeddingsPerCall?.({ model }) ?? model.maxEmbeddingsPerCall,
    supportsParallelCalls:
      overrideSupportsParallelCalls?.({ model }) ?? model.supportsParallelCalls,
    async doEmbed(
      params: EmbeddingModelV4CallOptions,
    ): Promise<EmbeddingModelV4Result> {
      const transformedParams = await doTransform({ params });
      const doEmbed = async () => await model.doEmbed(transformedParams);
      return wrapEmbed
        ? await wrapEmbed({
            doEmbed,
            params: transformedParams,
            model,
          })
        : await doEmbed();
    },
  };
};
