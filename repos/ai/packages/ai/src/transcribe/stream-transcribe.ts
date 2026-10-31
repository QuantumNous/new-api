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
import { mergeAbortSignals } from '../util/merge-abort-signals';
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
          ? ' String model IDs resolve through the global provider (AI Gateway by default).' +
            ' If that provider does not support streaming transcription, pass a provider model' +
            " instance instead (e.g. openai.transcription('gpt-realtime-whisper'))" +
            ' or upgrade @ai-sdk/gateway to a version with streaming transcription support.'
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
      // merged so cancelling fullStream also aborts a still-pending doStream
      abortSignal: mergeAbortSignals(abortSignal, pipeAbortController.signal),
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
    // When `doStream` rejects before the model stream exists (e.g. auth or
    // header resolution failure), nothing has taken ownership of `audio` yet,
    // so cancel it directly — otherwise an upstream producer piping into it
    // hangs forever. When the model did take a reader, `audio` is locked and
    // the cancel rejects, which is fine: the model's cleanup owns it then.
    audio.cancel(reason).catch(() => {});
    transform.writable.abort(reason).catch(() => {
      // the writable is already errored when the model stream failed mid-pipe
    });
  });

  // Transcription streams can be unbounded (live microphone + raw chunks), so
  // unlike streamText we cannot retain an unread tee branch for replay. The
  // output stream has one owner: either fullStream, or the first result promise
  // getter which claims and drains it internally.
  let streamOwner: 'unclaimed' | 'full-stream' | 'result-promises' =
    'unclaimed';

  function consumeStream() {
    if (streamOwner === 'full-stream' || streamOwner === 'result-promises') {
      return;
    }
    streamOwner = 'result-promises';
    const reader = transform.readable.getReader();
    void (async () => {
      while (!(await reader.read()).done) {
        // drain; results surface via the promises
      }
    })().catch(() => {
      // stream errors reject the promises via the pipe handler above
    });
  }

  function getFullStream() {
    if (streamOwner !== 'unclaimed') {
      throw new Error(
        streamOwner === 'full-stream'
          ? 'fullStream can only be accessed once.'
          : 'fullStream cannot be accessed after a result promise.',
      );
    }
    streamOwner = 'full-stream';
    // Direct ownership preserves backpressure and cancellation: cancelling
    // this stream reaches Transformer.cancel and aborts the model pipe.
    return asAsyncIterableStream(transform.readable);
  }

  return {
    get text() {
      consumeStream();
      return textPromise.promise;
    },
    get segments() {
      consumeStream();
      return segmentsPromise.promise;
    },
    get language() {
      consumeStream();
      return languagePromise.promise;
    },
    get durationInSeconds() {
      consumeStream();
      return durationInSecondsPromise.promise;
    },
    get warnings() {
      consumeStream();
      return warningsPromise.promise;
    },
    get responses() {
      consumeStream();
      return responsesPromise.promise;
    },
    get providerMetadata() {
      consumeStream();
      return providerMetadataPromise.promise;
    },
    get fullStream() {
      return getFullStream();
    },
  };
}
