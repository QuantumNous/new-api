import {
  UnsupportedFunctionalityError,
  type Experimental_TranscriptionModelV4StreamPart,
  type JSONObject,
} from '@ai-sdk/provider';
import {
  DelayedPromise,
  withUserAgentSuffix,
  type ProviderOptions,
} from '@ai-sdk/provider-utils';
import { NoTranscriptGeneratedError } from '../error/no-transcript-generated-error';
import { logWarnings } from '../logger/log-warnings';
import { resolveTranscriptionModel } from '../model/resolve-model';
import type { TranscriptionModel } from '../types/transcription-model';
import type { TranscriptionModelResponseMetadata } from '../types/transcription-model-response-metadata';
import type { Warning } from '../types/warning';
import { asAsyncIterableStream } from '../util/async-iterable-stream';
import { VERSION } from '../version';
import type {
  StreamTranscriptionResult,
  TranscriptionStreamPart,
} from './stream-transcribe-result';

type TranscriptSegment = {
  text: string;
  startSecond: number;
  endSecond: number;
};

/**
 * Streams transcripts using a transcription model.
 *
 * @param model - The transcription model to use.
 * @param audio - Raw audio chunks to transcribe.
 * @param inputAudioFormat - The input audio format for the raw audio chunks.
 * @param providerOptions - Additional provider-specific options.
 * @param abortSignal - An optional abort signal that can be used to cancel the call.
 * @param headers - Additional HTTP/WebSocket headers to send when supported by the provider.
 *
 * @returns A result object that contains the streaming transcript and final transcript metadata.
 */
export function streamTranscribe({
  model,
  audio,
  inputAudioFormat,
  providerOptions = {},
  abortSignal,
  headers,
  includeRawChunks,
  _internal: { currentDate = () => new Date() } = {},
}: {
  /**
   * The transcription model to use.
   */
  model: TranscriptionModel;

  /**
   * Raw audio chunks to transcribe.
   */
  audio: ReadableStream<Uint8Array | string>;

  /**
   * The input audio format for the raw audio chunks.
   */
  inputAudioFormat: {
    /**
     * Audio format type, e.g. `audio/pcm`, `audio/pcmu`, or `audio/pcma`.
     */
    type: string;

    /**
     * Sample rate in Hz. Only applicable for formats that require a rate.
     */
    rate?: number;
  };

  /**
   * Additional provider-specific options.
   */
  providerOptions?: ProviderOptions;

  /**
   * Abort signal.
   */
  abortSignal?: AbortSignal;

  /**
   * Additional headers to include in the request, if supported by the provider.
   */
  headers?: Record<string, string>;

  /**
   * When true, providers should include raw provider chunks in the stream.
   */
  includeRawChunks?: boolean;

  /**
   * Internal test hooks.
   */
  _internal?: {
    currentDate?: () => Date;
  };
}): StreamTranscriptionResult {
  const resolvedModel = resolveTranscriptionModel(model);
  if (!resolvedModel) {
    throw new Error('Model could not be resolved');
  }

  const doStream = resolvedModel.doStream?.bind(resolvedModel);
  if (doStream == null) {
    throw new UnsupportedFunctionalityError({
      functionality: 'streaming transcription',
      message:
        `The ${resolvedModel.provider} model "${resolvedModel.modelId}" does not support streaming transcription.` +
        (typeof model === 'string'
          ? ' String model IDs resolve through the global provider (AI Gateway by default),' +
            ' which does not support streaming transcription yet.' +
            " Pass a provider model instance instead, e.g. openai.transcription('gpt-realtime-whisper')."
          : ''),
    });
  }

  const headersWithUserAgent = withUserAgentSuffix(
    headers ?? {},
    `ai/${VERSION}`,
  );

  const textPromise = new DelayedPromise<string>();
  const segmentsPromise = new DelayedPromise<Array<TranscriptSegment>>();
  const languagePromise = new DelayedPromise<string | undefined>();
  const durationInSecondsPromise = new DelayedPromise<number | undefined>();
  const warningsPromise = new DelayedPromise<Array<Warning>>();
  const responsesPromise = new DelayedPromise<
    Array<TranscriptionModelResponseMetadata>
  >();
  const providerMetadataPromise = new DelayedPromise<
    Record<string, JSONObject>
  >();

  const rejectPendingPromises = (error: unknown) => {
    for (const promise of [
      textPromise,
      segmentsPromise,
      languagePromise,
      durationInSecondsPromise,
      warningsPromise,
      responsesPromise,
      providerMetadataPromise,
    ]) {
      if (promise.isPending()) {
        promise.reject(error);
      }
    }
  };

  const startedAt = currentDate();
  let response: TranscriptionModelResponseMetadata | undefined;
  const currentResponseMetadata = () =>
    response ?? { timestamp: startedAt, modelId: resolvedModel.modelId };

  const resolveWarnings = (warnings: Array<Warning>) => {
    warningsPromise.resolve(warnings);
    logWarnings({
      warnings,
      provider: resolvedModel.provider,
      model: resolvedModel.modelId,
    });
  };

  // When the consumer cancels `fullStream` early, we abort the model pipe below
  // with a defined reason via this controller. Relying on the default cancel
  // cascade aborts the pipe with an `undefined` reason, which surfaces as a
  // spurious unhandled rejection on Node.js 26 when the transform drops chunks.
  const pipeAbortController = new AbortController();

  // `Transformer.cancel` is part of the Streams spec (and supported at runtime),
  // but not yet reflected in the ambient `Transformer` type, so widen it here.
  const transformer: Transformer<
    Experimental_TranscriptionModelV4StreamPart,
    TranscriptionStreamPart
  > & { cancel?: (reason?: unknown) => void } = {
    transform(value, controller) {
      switch (value.type) {
        case 'stream-start': {
          resolveWarnings(value.warnings);
          break;
        }

        case 'response-metadata': {
          response = {
            timestamp: value.timestamp ?? currentResponseMetadata().timestamp,
            modelId: value.modelId ?? currentResponseMetadata().modelId,
            headers: value.headers ?? response?.headers,
          };
          break;
        }

        case 'transcript-delta':
        case 'transcript-partial':
        case 'transcript-final':
        case 'raw':
        case 'error': {
          controller.enqueue(value);
          break;
        }

        case 'finish': {
          if (!warningsPromise.isResolved()) {
            resolveWarnings([]);
          }

          if (!value.text) {
            throw new NoTranscriptGeneratedError({
              responses: [currentResponseMetadata()],
            });
          }

          textPromise.resolve(value.text);
          segmentsPromise.resolve(value.segments);
          languagePromise.resolve(value.language);
          durationInSecondsPromise.resolve(value.durationInSeconds);
          responsesPromise.resolve([currentResponseMetadata()]);
          providerMetadataPromise.resolve(value.providerMetadata ?? {});
          break;
        }
      }
    },

    flush() {
      if (textPromise.isPending()) {
        throw new NoTranscriptGeneratedError({
          responses: [currentResponseMetadata()],
        });
      }
    },

    cancel(reason) {
      pipeAbortController.abort(
        reason ?? new Error('Transcription stream was cancelled.'),
      );
    },
  };

  const transform = new TransformStream<
    Experimental_TranscriptionModelV4StreamPart,
    TranscriptionStreamPart
  >(transformer);

  // Piping (instead of an eager read loop) preserves consumer backpressure
  // and propagates cancellation of `fullStream` to the model stream.
  void (async () => {
    const result = await doStream({
      audio,
      inputAudioFormat,
      providerOptions,
      abortSignal,
      headers: headersWithUserAgent,
      includeRawChunks,
    });

    response = {
      timestamp: result.response?.timestamp ?? startedAt,
      modelId: result.response?.modelId ?? resolvedModel.modelId,
      headers: result.response?.headers,
    };

    await result.stream.pipeTo(transform.writable, {
      signal: pipeAbortController.signal,
    });
  })().catch(error => {
    const reason =
      error ?? new Error('Transcription stream was cancelled or errored.');
    rejectPendingPromises(reason);
    transform.writable.abort(reason).catch(() => {
      // the writable is already errored when the model stream failed mid-pipe
    });
  });

  return {
    get text() {
      return textPromise.promise;
    },
    get segments() {
      return segmentsPromise.promise;
    },
    get language() {
      return languagePromise.promise;
    },
    get durationInSeconds() {
      return durationInSecondsPromise.promise;
    },
    get warnings() {
      return warningsPromise.promise;
    },
    get responses() {
      return responsesPromise.promise;
    },
    get providerMetadata() {
      return providerMetadataPromise.promise;
    },
    // `transform.readable` is fresh and exclusively owned here, so attach the
    // async iterator in place rather than piping through another transform.
    // The extra transform (as `createAsyncIterableStream` would add) chains two
    // transforms fed by the active model pipe below and surfaces a spurious
    // unhandled `undefined` rejection when the consumer cancels early on
    // Node.js 26.
    fullStream: asAsyncIterableStream(transform.readable),
  };
}
