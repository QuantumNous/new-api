import type { JSONObject } from '../../json-value';
import type { SharedV4Headers, SharedV4ProviderOptions } from '../../shared/v4';

export type RerankingModelV4CallOptions = {
  /**
   * Documents to rerank.
   * Either a list of texts or a list of JSON objects.
   */
  documents:
    | { type: 'text'; values: string[] }
    | { type: 'object'; values: JSONObject[] };

  /**
   * The query is a string that represents the query to rerank the documents against.
   */
  query: string;

  /**
   * Optional limit returned documents to the top n documents.
   */
  topN?: number;

  /**
   * Abort signal for cancelling the operation.
   */
  abortSignal?: AbortSignal;

  /**
   * Additional provider-specific options. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: SharedV4ProviderOptions;

  /**
   * Additional HTTP headers to be sent with the request.
   * Only applicable for HTTP-based providers.
   */
  headers?: SharedV4Headers;
};
