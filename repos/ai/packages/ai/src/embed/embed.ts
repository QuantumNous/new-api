import {
  createIdGenerator,
  withUserAgentSuffix,
  type ProviderOptions,
} from '@ai-sdk/provider-utils';
import { logWarnings } from '../logger/log-warnings';
import { resolveEmbeddingModel } from '../model/resolve-model';
import { createTelemetryDispatcher } from '../telemetry/create-telemetry-dispatcher';
import type { TelemetryOptions } from '../telemetry/telemetry-options';
import type { EmbeddingModel } from '../types';
import type { Callback } from '../util/callback';
import { notify } from '../util/notify';
import { prepareRetries } from '../util/prepare-retries';
import { VERSION } from '../version';
import type { EmbedEndEvent, EmbedStartEvent } from './embed-events';
import type { EmbedResult } from './embed-result';

const originalGenerateCallId = createIdGenerator({
  prefix: 'call',
  size: 24,
});

/**
 * Embed a value using an embedding model. The type of the value is defined by the embedding model.
 *
 * @param model - The embedding model to use.
 * @param value - The value that should be embedded.
 *
 * @param maxRetries - Maximum number of retries. Set to 0 to disable retries. Default: 2.
 * @param abortSignal - An optional abort signal that can be used to cancel the call.
 * @param headers - Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.
 *
 * @param telemetry - Optional telemetry configuration.
 *
 * @param providerOptions - Additional provider-specific options. They are passed through
 * to the provider from the AI SDK and enable provider-specific
 * functionality that can be fully encapsulated in the provider.
 *
 * @returns A result object that contains the embedding, the value, and additional information.
 */
export async function embed({
  model: modelArg,
  value,
  providerOptions,
  maxRetries: maxRetriesArg,
  abortSignal,
  headers,
  experimental_telemetry,
  telemetry = experimental_telemetry,
  onStart,
  experimental_onStart,
  onEnd,
  experimental_onEnd,
  _internal: { generateCallId = originalGenerateCallId } = {},
}: {
  /**
   * The embedding model to use.
   */
  model: EmbeddingModel;

  /**
   * The value that should be embedded.
   */
  value: string;

  /**
   * Maximum number of retries per embedding model call. Set to 0 to disable retries.
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
   * Additional provider-specific options. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;

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
   * Callback that is called when the embed operation begins,
   * before the embedding model is called.
   */
  onStart?: Callback<EmbedStartEvent>;

  /**
   * Callback that is called when the embed operation begins,
   * before the embedding model is called.
   *
   * @deprecated Use `onStart` instead.
   */
  experimental_onStart?: Callback<EmbedStartEvent>;

  /**
   * Callback that is called when the embed operation completes,
   * after the embedding model returns.
   */
  onEnd?: Callback<EmbedEndEvent>;

  /**
   * Callback that is called when the embed operation completes,
   * after the embedding model returns.
   *
   * @deprecated Use `onEnd` instead.
   */
  experimental_onEnd?: Callback<EmbedEndEvent>;

  /**
   * Internal. For test use only. May change without notice.
   */
  _internal?: {
    generateCallId?: () => string;
  };
}): Promise<EmbedResult> {
  const model = resolveEmbeddingModel(modelArg);

  const { maxRetries, retry } = prepareRetries({
    maxRetries: maxRetriesArg,
    abortSignal,
  });
  const resolvedOnStart = onStart ?? experimental_onStart;
  const resolvedOnEnd = onEnd ?? experimental_onEnd;

  const headersWithUserAgent = withUserAgentSuffix(
    headers ?? {},
    `ai/${VERSION}`,
  );

  const callId = generateCallId();

  const telemetryDispatcher = createTelemetryDispatcher({
    telemetry,
  });

  const runInTracingChannelSpan =
    telemetryDispatcher.runInTracingChannelSpan ??
    (async <T>({ execute }: { execute: () => PromiseLike<T> }) =>
      await execute());

  const startEvent = {
    callId,
    operationId: 'ai.embed',
    provider: model.provider,
    modelId: model.modelId,
    value,
    maxRetries,
    headers: headersWithUserAgent,
    providerOptions,
  };

  return await runInTracingChannelSpan({
    type: 'embed',
    event: startEvent,
    execute: async () => {
      await notify({
        event: startEvent,
        callbacks: [resolvedOnStart, telemetryDispatcher.onStart],
      });

      try {
        const { embedding, usage, warnings, response, providerMetadata } =
          await retry(async () => {
            const embedCallId = generateCallId();

            await notify({
              event: {
                callId,
                embedCallId,
                operationId: 'ai.embed.doEmbed',
                provider: model.provider,
                modelId: model.modelId,
                values: [value],
              },
              callbacks: [telemetryDispatcher.onEmbedStart],
            });

            const modelResponse = await model.doEmbed({
              values: [value],
              abortSignal,
              headers: headersWithUserAgent,
              providerOptions,
            });

            const embedding = modelResponse.embeddings[0];
            const usage = modelResponse.usage ?? { tokens: NaN };

            await notify({
              event: {
                callId,
                embedCallId,
                operationId: 'ai.embed.doEmbed',
                provider: model.provider,
                modelId: model.modelId,
                values: [value],
                embeddings: modelResponse.embeddings,
                usage,
              },
              callbacks: [telemetryDispatcher.onEmbedEnd],
            });

            return {
              embedding,
              usage,
              warnings: modelResponse.warnings ?? [],
              providerMetadata: modelResponse.providerMetadata,
              response: modelResponse.response,
            };
          });

        logWarnings({
          warnings,
          provider: model.provider,
          model: model.modelId,
        });

        await notify({
          event: {
            callId,
            operationId: 'ai.embed',
            provider: model.provider,
            modelId: model.modelId,
            value,
            embedding,
            usage,
            warnings,
            providerMetadata,
            response,
          },
          callbacks: [resolvedOnEnd, telemetryDispatcher.onEnd],
        });

        return new DefaultEmbedResult({
          value,
          embedding,
          usage,
          warnings,
          providerMetadata,
          response,
        });
      } catch (error) {
        await telemetryDispatcher.onError?.({ callId, error });
        throw error;
      }
    },
  });
}

class DefaultEmbedResult implements EmbedResult {
  readonly value: EmbedResult['value'];
  readonly embedding: EmbedResult['embedding'];
  readonly usage: EmbedResult['usage'];
  readonly warnings: EmbedResult['warnings'];
  readonly providerMetadata: EmbedResult['providerMetadata'];
  readonly response: EmbedResult['response'];

  constructor(options: {
    value: EmbedResult['value'];
    embedding: EmbedResult['embedding'];
    usage: EmbedResult['usage'];
    warnings: EmbedResult['warnings'];
    providerMetadata?: EmbedResult['providerMetadata'];
    response?: EmbedResult['response'];
  }) {
    this.value = options.value;
    this.embedding = options.embedding;
    this.usage = options.usage;
    this.warnings = options.warnings;
    this.providerMetadata = options.providerMetadata;
    this.response = options.response;
  }
}
