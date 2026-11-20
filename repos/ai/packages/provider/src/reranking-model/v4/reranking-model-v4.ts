import type { RerankingModelV4CallOptions } from './reranking-model-v4-call-options';
import type { RerankingModelV4Result } from './reranking-model-v4-result';

/**
 * Specification for a reranking model that implements the reranking model interface version 3.
 */
export type RerankingModelV4 = {
  /**
   * The reranking model must specify which reranking model interface version it implements.
   */
  readonly specificationVersion: 'v4';

  /**
   * Provider ID.
   */
  readonly provider: string;

  /**
   * Provider-specific model ID.
   */
  readonly modelId: string;

  /**
   * Reranking a list of documents using the query.
   */
  // Naming: "do" prefix to prevent accidental direct usage of the method by the user.
  doRerank(
    options: RerankingModelV4CallOptions,
  ): PromiseLike<RerankingModelV4Result>;
};
