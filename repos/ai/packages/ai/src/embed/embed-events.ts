import type { ProviderOptions } from '@ai-sdk/provider-utils';
import type { Embedding, ProviderMetadata } from '../types';
import type { EmbeddingModelUsage } from '../types/usage';
import type { Warning } from '../types/warning';

/**
 * Event passed to the `onStart` callback for embed and embedMany operations.
 *
 * Called when the operation begins, before the embedding model is called.
 */
export type EmbedStartEvent = {
  /** Unique identifier for this embed call, used to correlate events. */
  readonly callId: string;

  /** Identifies the operation type (e.g. 'ai.embed' or 'ai.embedMany'). */
  readonly operationId: string;

  /** The provider identifier (e.g., 'openai', 'anthropic'). */
  readonly provider: string;

  /** The specific model identifier (e.g., 'text-embedding-3-small'). */
  readonly modelId: string;

  /** The value(s) being embedded. A string for embed, an array for embedMany. */
  readonly value: string | Array<string>;

  /** Maximum number of retries for failed requests. */
  readonly maxRetries: number;

  /** Additional HTTP headers sent with the request. */
  readonly headers: Record<string, string | undefined> | undefined;

  /** Additional provider-specific options. */
  readonly providerOptions: ProviderOptions | undefined;
};

/**
 * Event passed to the `onEnd` callback for embed and embedMany operations.
 *
 * Called when the operation completes, after the embedding model returns.
 */
export type EmbedEndEvent = {
  /** Unique identifier for this embed call, used to correlate events. */
  readonly callId: string;

  /** Identifies the operation type (e.g. 'ai.embed' or 'ai.embedMany'). */
  readonly operationId: string;

  /** The provider identifier (e.g., 'openai', 'anthropic'). */
  readonly provider: string;

  /** The specific model identifier (e.g., 'text-embedding-3-small'). */
  readonly modelId: string;

  /** The value(s) that were embedded. A string for embed, an array for embedMany. */
  readonly value: string | Array<string>;

  /** The resulting embedding(s). A single vector for embed, an array for embedMany. */
  readonly embedding: Embedding | Array<Embedding>;

  /** Token usage for the embedding operation. */
  readonly usage: EmbeddingModelUsage;

  /** Warnings from the embedding model, e.g. unsupported settings. */
  readonly warnings: Array<Warning>;

  /** Optional provider-specific metadata. */
  readonly providerMetadata: ProviderMetadata | undefined;

  /** Response data including headers and body. A single response for embed, an array for embedMany. */
  readonly response:
    | { headers?: Record<string, string>; body?: unknown }
    | Array<{ headers?: Record<string, string>; body?: unknown } | undefined>
    | undefined;
};

/**
 * Event fired when an individual embedding model call (inner operation doEmbed) begins.
 *
 * For `embed`, there is one call. For `embedMany`, there may be multiple
 * calls when values are chunked.
 */
export type EmbeddingModelCallStartEvent = {
  /** Unique identifier for this embed call, used to correlate events. */
  readonly callId: string;

  /** Unique identifier for this individual doEmbed invocation, used to correlate start/finish within parallel chunks. */
  readonly embedCallId: string;

  /** Identifies the inner operation (e.g. 'ai.embed.doEmbed' or 'ai.embedMany.doEmbed'). */
  readonly operationId: string;

  /** The provider identifier. */
  readonly provider: string;

  /** The specific model identifier. */
  readonly modelId: string;

  /** The values being embedded in this particular model call. */
  readonly values: Array<string>;
};

/**
 * Event fired when an individual embedding model call (doEmbed) completes.
 *
 * Contains the embeddings, usage, and any warnings from the model response.
 */
export type EmbeddingModelCallEndEvent = {
  /** Unique identifier for this embed call, used to correlate events. */
  readonly callId: string;

  /** Unique identifier for this individual doEmbed invocation, used to correlate start/finish within parallel chunks. */
  readonly embedCallId: string;

  /** Identifies the inner operation (e.g. 'ai.embed.doEmbed' or 'ai.embedMany.doEmbed'). */
  readonly operationId: string;

  /** The provider identifier. */
  readonly provider: string;

  /** The specific model identifier. */
  readonly modelId: string;

  /** The values that were embedded in this particular model call. */
  readonly values: Array<string>;

  /** The resulting embeddings from the model call. */
  readonly embeddings: Array<Embedding>;

  /** Token usage for this model call. */
  readonly usage: EmbeddingModelUsage;
};
