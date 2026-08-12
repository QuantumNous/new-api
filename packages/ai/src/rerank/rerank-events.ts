import type { JSONObject } from '@ai-sdk/provider';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import type { ProviderMetadata } from '../types';
import type { Warning } from '../types/warning';

/**
 * Event passed to the `onStart` callback for rerank operations.
 *
 * Called when the operation begins, before the reranking model is called.
 */
export type RerankStartEvent = {
  /** Unique identifier for this rerank call, used to correlate events. */
  readonly callId: string;

  /** Identifies the operation type ('ai.rerank'). */
  readonly operationId: string;

  //** The provider identifier (e.g., 'openai', 'anthropic'). */
  readonly provider: string;

  /** The specific model identifier (e.g., 'gpt-4o'). */
  readonly modelId: string;
  /** The documents being reranked. */
  readonly documents: Array<JSONObject | string>;

  /** The query to rerank the documents against. */
  readonly query: string;

  /** Number of top documents to return. */
  readonly topN: number | undefined;

  /** Maximum number of retries for failed requests. */
  readonly maxRetries: number;
  /** Additional HTTP headers sent with the request. */
  readonly headers: Record<string, string | undefined> | undefined;

  /** Additional provider-specific options. */
  readonly providerOptions: ProviderOptions | undefined;
};

/**
 * Event passed to the `onEnd` callback for rerank operations.
 *
 * Called when the operation completes, after the reranking model returns.
 */
export type RerankEndEvent = {
  /** Unique identifier for this rerank call, used to correlate events. */
  readonly callId: string;

  /** Identifies the operation type ('ai.rerank'). */
  readonly operationId: string;

  //** The provider identifier (e.g., 'openai', 'anthropic'). */
  readonly provider: string;

  /** The specific model identifier (e.g., 'gpt-4o'). */
  readonly modelId: string;

  /** The documents that were reranked. */
  readonly documents: Array<JSONObject | string>;

  /** The query that documents were reranked against. */
  readonly query: string;

  /** The reranked results sorted by relevance score in descending order. */
  readonly ranking: Array<{
    originalIndex: number;
    score: number;
    document: JSONObject | string;
  }>;

  /** Warnings from the reranking model. */
  readonly warnings: Array<Warning>;

  /** Optional provider-specific metadata. */
  readonly providerMetadata: ProviderMetadata | undefined;

  /** Response data including headers and body. */
  readonly response: {
    id?: string;
    timestamp: Date;
    modelId: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
};

/**
 * Event fired when an individual reranking model call (inner doRerank) begins.
 */
export type RerankingModelCallStartEvent = {
  /** Unique identifier for this rerank call, used to correlate events. */
  readonly callId: string;

  /** Identifies the inner operation ('ai.rerank.doRerank'). */
  readonly operationId: string;

  /** The provider identifier. */
  readonly provider: string;

  /** The specific model identifier. */
  readonly modelId: string;

  /** The documents being reranked. */
  readonly documents: Array<JSONObject | string>;

  /** The type of documents ('text' or 'object'). */
  readonly documentsType: string;

  /** The query to rerank against. */
  readonly query: string;

  /** Number of top documents to return. */
  readonly topN: number | undefined;
};

/**
 * Event fired when an individual reranking model call (doRerank) completes.
 *
 * Contains the ranking results from the model response.
 */
export type RerankingModelCallEndEvent = {
  /** Unique identifier for this rerank call, used to correlate events. */
  readonly callId: string;

  /** Identifies the inner operation ('ai.rerank.doRerank'). */
  readonly operationId: string;

  /** The provider identifier. */
  readonly provider: string;

  /** The specific model identifier. */
  readonly modelId: string;

  /** The type of documents ('text' or 'object'). */
  readonly documentsType: string;

  /** The ranking results from the model. */
  readonly ranking: Array<{ index: number; relevanceScore: number }>;
};
