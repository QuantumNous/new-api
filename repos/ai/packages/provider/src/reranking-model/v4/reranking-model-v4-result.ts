import type {
  SharedV4Headers,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '../../shared/v4/';

/**
 * The result of a reranking model doRerank call.
 */
export type RerankingModelV4Result = {
  /**
   * Ordered list of reranked documents (via index before reranking).
   * The documents are sorted by the descending order of relevance scores.
   */
  ranking: Array<{
    /**
     * The index of the document in the original list of documents before reranking.
     */
    index: number;

    /**
     * The relevance score of the document after reranking.
     */
    relevanceScore: number;
  }>;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: SharedV4ProviderMetadata;

  /**
   * Warnings for the call, e.g. unsupported settings.
   */
  warnings?: Array<SharedV4Warning>;

  /**
   * Optional response information for debugging purposes.
   */
  response?: {
    /**
     * ID for the generated response, if the provider sends one.
     */
    id?: string;

    /**
     * Timestamp for the start of the generated response, if the provider sends one.
     */
    timestamp?: Date;

    /**
     * The ID of the response model that was used to generate the response, if the provider sends one.
     */
    modelId?: string;

    /**
     * Response headers.
     */
    headers?: SharedV4Headers;

    /**
     * Response body.
     */
    body?: unknown;
  };
};
