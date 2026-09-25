import type { EmbeddingModelV4 } from '../../embedding-model/v4/embedding-model-v4';
import type { EmbeddingModelV4CallOptions } from '../../embedding-model/v4/embedding-model-v4-call-options';

/**
 * Middleware for EmbeddingModelV4.
 * This type defines the structure for middleware that can be used to modify
 * the behavior of EmbeddingModelV4 operations.
 */
export type EmbeddingModelV4Middleware = {
  /**
   * Middleware specification version. Use `v4` for the current version.
   */
  readonly specificationVersion: 'v4';

  /**
   * Override the provider name if desired.
   * @param options.model - The embedding model instance.
   */
  overrideProvider?: (options: { model: EmbeddingModelV4 }) => string;

  /**
   * Override the model ID if desired.
   * @param options.model - The embedding model instance.
   */
  overrideModelId?: (options: { model: EmbeddingModelV4 }) => string;

  /**
   * Override the limit of how many embeddings can be generated in a single API call if desired.
   * @param options.model - The embedding model instance.
   */
  overrideMaxEmbeddingsPerCall?: (options: {
    model: EmbeddingModelV4;
  }) => PromiseLike<number | undefined> | number | undefined;

  /**
   * Override support for handling multiple embedding calls in parallel, if desired..
   * @param options.model - The embedding model instance.
   */
  overrideSupportsParallelCalls?: (options: {
    model: EmbeddingModelV4;
  }) => PromiseLike<boolean> | boolean;

  /**
   * Transforms the parameters before they are passed to the embed model.
   * @param options - Object containing the type of operation and the parameters.
   * @param options.params - The original parameters for the embedding model call.
   * @returns A promise that resolves to the transformed parameters.
   */
  transformParams?: (options: {
    params: EmbeddingModelV4CallOptions;
    model: EmbeddingModelV4;
  }) => PromiseLike<EmbeddingModelV4CallOptions>;

  /**
   * Wraps the embed operation of the embedding model.
   *
   * @param options - Object containing the embed function, parameters, and model.
   * @param options.doEmbed - The original embed function.
   * @param options.params - The parameters for the embed call. If the
   * `transformParams` middleware is used, this will be the transformed parameters.
   * @param options.model - The embedding model instance.
   * @returns A promise that resolves to the result of the generate operation.
   */
  wrapEmbed?: (options: {
    doEmbed: () => ReturnType<EmbeddingModelV4['doEmbed']>;
    params: EmbeddingModelV4CallOptions;
    model: EmbeddingModelV4;
  }) => Promise<Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>>;
};
