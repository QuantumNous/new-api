import type { JSONObject, RerankingModelV4CallOptions } from '@ai-sdk/provider';
import {
  createIdGenerator,
  type ProviderOptions,
} from '@ai-sdk/provider-utils';
import { prepareRetries } from '../../src/util/prepare-retries';
import { logWarnings } from '../logger/log-warnings';
import { resolveRerankingModel } from '../model/resolve-model';
import { createTelemetryDispatcher } from '../telemetry/create-telemetry-dispatcher';
import type { TelemetryOptions } from '../telemetry/telemetry-options';
import type { RerankingModel } from '../types';
import type { Callback } from '../util/callback';
import { notify } from '../util/notify';
import type { RerankEndEvent, RerankStartEvent } from './rerank-events';
import type { RerankResult } from './rerank-result';

const originalGenerateCallId = createIdGenerator({
  prefix: 'call',
  size: 24,
});

/**
 * Rerank documents using a reranking model. The type of the value is defined by the reranking model.
 *
 * @param model - The reranking model to use.
 * @param documents - The documents that should be reranked.
 * @param query - The query to rerank the documents against.
 * @param topN - Number of top documents to return.
 *
 * @param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
 * @param abortSignal - An optional abort signal that can be used to cancel the call.
 * @param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.
 * @param providerOptions - Additional provider-specific options.
 * @param telemetry - Optional telemetry configuration.
 *
 * @returns A result object that contains the reranked documents, the reranked indices, and additional information.
 */
export async function rerank<VALUE extends JSONObject | string>({
  model: modelArg,
  documents,
  query,
  topN,
  maxRetries: maxRetriesArg,
  abortSignal,
  headers,
  providerOptions,
  experimental_telemetry,
  telemetry = experimental_telemetry,
  onStart,
  experimental_onStart,
  onEnd,
  experimental_onEnd,
  _internal: { generateCallId = originalGenerateCallId } = {},
}: {
  /**
   * The reranking model to use.
   */
  model: RerankingModel;

  /**
   * The documents that should be reranked.
   */
  documents: Array<VALUE>;

  /**
   * The query to rerank the documents against.
   */
  query: string;

  /**
   * Number of top documents to return.
   */
  topN?: number;

  /**
   * Maximum number of retries per reranking model call. Set to 0 to disable retries.
   *
   * @default 2
   */
  maxRetries?: number;

  /**
   * Abort signal.
   */
  abortSignal?: AbortSignal;

  /**
   * Additional headers to include in the request.
   * Only applicable for HTTP-based providers.
   */
  headers?: Record<string, string>;

  /**
   * Optional telemetry configuration.
   */
  telemetry?: TelemetryOptions;

  /**
   * Optional telemetry configuration.
   *
   * @deprecated Use `telemetry` instead. This alias will be removed in a future major release.
   */
  experimental_telemetry?: TelemetryOptions;

  /**
   * Additional provider-specific options. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;

  /**
   * Callback that is called when the rerank operation begins,
   * before the reranking model is called.
   */
  onStart?: Callback<RerankStartEvent>;

  /**
   * Callback that is called when the rerank operation begins,
   * before the reranking model is called.
   *
   * @deprecated Use `onStart` instead.
   */
  experimental_onStart?: Callback<RerankStartEvent>;

  /**
   * Callback that is called when the rerank operation completes,
   * after the reranking model returns.
   */
  onEnd?: Callback<RerankEndEvent>;

  /**
   * Callback that is called when the rerank operation completes,
   * after the reranking model returns.
   *
   * @deprecated Use `onEnd` instead.
   */
  experimental_onEnd?: Callback<RerankEndEvent>;

  /**
   * Internal. For test use only. May change without notice.
   */
  _internal?: {
    generateCallId?: () => string;
  };
}): Promise<RerankResult<VALUE>> {
  const model = resolveRerankingModel(modelArg);
  const callId = generateCallId();
  const resolvedOnStart = onStart ?? experimental_onStart;
  const resolvedOnEnd = onEnd ?? experimental_onEnd;

  const telemetryDispatcher = createTelemetryDispatcher({
    telemetry,
  });

  const runInTracingChannelSpan =
    telemetryDispatcher.runInTracingChannelSpan ??
    (async <T>({ execute }: { execute: () => PromiseLike<T> }) =>
      await execute());

  if (documents.length === 0) {
    await notify({
      event: {
        callId,
        operationId: 'ai.rerank',
        provider: model.provider,
        modelId: model.modelId,
        documents,
        query,
        topN,
        maxRetries: maxRetriesArg ?? 2,
        headers,
        providerOptions,
      },
      callbacks: [resolvedOnStart, telemetryDispatcher.onStart],
    });

    await notify({
      event: {
        callId,
        operationId: 'ai.rerank',
        provider: model.provider,
        modelId: model.modelId,
        documents,
        query,
        ranking: [],
        warnings: [],
        providerMetadata: undefined,
        response: {
          timestamp: new Date(),
          modelId: model.modelId,
        },
      },
      callbacks: [resolvedOnEnd, telemetryDispatcher.onEnd],
    });

    return new DefaultRerankResult({
      originalDocuments: [],
      ranking: [],
      providerMetadata: undefined,
      response: {
        timestamp: new Date(),
        modelId: model.modelId,
      },
    });
  }

  const { maxRetries, retry } = prepareRetries({
    maxRetries: maxRetriesArg,
    abortSignal,
  });

  const documentsToSend: RerankingModelV4CallOptions['documents'] =
    typeof documents[0] === 'string'
      ? { type: 'text', values: documents as string[] }
      : { type: 'object', values: documents as JSONObject[] };

  const startEvent = {
    callId,
    operationId: 'ai.rerank',
    provider: model.provider,
    modelId: model.modelId,
    documents,
    query,
    topN,
    maxRetries,
    headers,
    providerOptions,
  };

  return await runInTracingChannelSpan({
    type: 'rerank',
    event: startEvent,
    execute: async () => {
      await notify({
        event: startEvent,
        callbacks: [resolvedOnStart, telemetryDispatcher.onStart],
      });

      try {
        const { ranking, response, providerMetadata, warnings } = await retry(
          async () => {
            await notify({
              event: {
                callId,
                operationId: 'ai.rerank.doRerank',
                provider: model.provider,
                modelId: model.modelId,
                documents,
                documentsType: documentsToSend.type,
                query,
                topN,
              },
              callbacks: [telemetryDispatcher.onRerankStart],
            });

            const modelResponse = await model.doRerank({
              documents: documentsToSend,
              query,
              topN,
              providerOptions,
              abortSignal,
              headers,
            });

            const ranking = modelResponse.ranking;

            await notify({
              event: {
                callId,
                operationId: 'ai.rerank.doRerank',
                provider: model.provider,
                modelId: model.modelId,
                documentsType: documentsToSend.type,
                ranking,
              },
              callbacks: [telemetryDispatcher.onRerankEnd],
            });

            return {
              ranking,
              providerMetadata: modelResponse.providerMetadata,
              response: modelResponse.response,
              warnings: modelResponse.warnings,
            };
          },
        );

        logWarnings({
          warnings: warnings ?? [],
          provider: model.provider,
          model: model.modelId,
        });

        await notify({
          event: {
            callId,
            operationId: 'ai.rerank',
            provider: model.provider,
            modelId: model.modelId,
            documents,
            query,
            ranking: ranking.map(r => ({
              originalIndex: r.index,
              score: r.relevanceScore,
              document: documents[r.index],
            })),
            warnings: warnings ?? [],
            providerMetadata,
            response: {
              id: response?.id,
              timestamp: response?.timestamp ?? new Date(),
              modelId: response?.modelId ?? model.modelId,
              headers: response?.headers,
              body: response?.body,
            },
          },
          callbacks: [resolvedOnEnd, telemetryDispatcher.onEnd],
        });

        return new DefaultRerankResult({
          originalDocuments: documents,
          ranking: ranking.map(ranking => ({
            originalIndex: ranking.index,
            score: ranking.relevanceScore,
            document: documents[ranking.index],
          })),
          providerMetadata,
          response: {
            id: response?.id,
            timestamp: response?.timestamp ?? new Date(),
            modelId: response?.modelId ?? model.modelId,
            headers: response?.headers,
            body: response?.body,
          },
        });
      } catch (error) {
        await telemetryDispatcher.onError?.({ callId, error });
        throw error;
      }
    },
  });
}

class DefaultRerankResult<VALUE> implements RerankResult<VALUE> {
  readonly originalDocuments: RerankResult<VALUE>['originalDocuments'];
  readonly ranking: RerankResult<VALUE>['ranking'];
  readonly response: RerankResult<VALUE>['response'];
  readonly providerMetadata: RerankResult<VALUE>['providerMetadata'];

  constructor(options: {
    originalDocuments: RerankResult<VALUE>['originalDocuments'];
    ranking: RerankResult<VALUE>['ranking'];
    providerMetadata?: RerankResult<VALUE>['providerMetadata'];
    response: RerankResult<VALUE>['response'];
  }) {
    this.originalDocuments = options.originalDocuments;
    this.ranking = options.ranking;
    this.response = options.response;
    this.providerMetadata = options.providerMetadata;
  }

  get rerankedDocuments(): RerankResult<VALUE>['rerankedDocuments'] {
    return this.ranking.map(ranking => ranking.document);
  }
}
