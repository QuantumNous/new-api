import {
  InvalidArgumentError,
  UnsupportedFunctionalityError,
  type Experimental_TranscriptionModelV4StreamOptions as TranscriptionModelV4StreamOptions,
  type Experimental_TranscriptionModelV4StreamPart as TranscriptionModelV4StreamPart,
  type SharedV4Warning,
  type TranscriptionModelV4,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  connectToWebSocket,
  convertBase64ToUint8Array,
  createJsonResponseHandler,
  mediaTypeToExtension,
  parseProviderOptions,
  postFormDataToApi,
  postJsonToApi,
  safeParseJSON,
  serializeModelOptions,
  toWebSocketUrl,
  waitForWebSocketBufferDrain,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type WebSocketConnection,
  type WebSocketLike,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { CartesiaConfig } from './cartesia-config';
import { cartesiaFailedResponseHandler } from './cartesia-error';
import {
  cartesiaTranscriptionModelOptionsSchema,
  type CartesiaTranscriptionModelOptions,
} from './cartesia-transcription-model-options';
import type { CartesiaTranscriptionModelId } from './cartesia-transcription-options';

interface CartesiaTranscriptionModelConfig extends CartesiaConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

type CartesiaStreamingTranscriptionEvent = {
  type?: string;
  request_id?: string;
  transcript?: string;
  text?: string;
  is_final?: boolean;
  duration?: number;
  message?: string;
  error_code?: string;
};

export class CartesiaTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: CartesiaTranscriptionModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: CartesiaTranscriptionModelId;
    config: CartesiaTranscriptionModelConfig;
  }) {
    return new CartesiaTranscriptionModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: CartesiaTranscriptionModelId,
    private readonly config: CartesiaTranscriptionModelConfig,
  ) {}

  private async getArgs({
    audio,
    mediaType,
    providerOptions,
  }: Parameters<TranscriptionModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const cartesiaOptions = await parseProviderOptions({
      provider: 'cartesia',
      providerOptions,
      schema: cartesiaTranscriptionModelOptionsSchema,
    });

    if (cartesiaOptions?.streaming != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'providerOptions.cartesia.streaming',
        details:
          'Cartesia batch transcription does not support streaming options.',
      });
    }

    // Create form data with base fields
    const formData = new FormData();
    const blob =
      audio instanceof Uint8Array
        ? new Blob([audio])
        : new Blob([convertBase64ToUint8Array(audio)]);

    const fileExtension = mediaTypeToExtension(mediaType);
    formData.append('model', this.modelId);
    formData.append(
      'file',
      new File([blob], 'audio', { type: mediaType }),
      `audio.${fileExtension}`,
    );

    // Add provider-specific options
    if (cartesiaOptions) {
      if (cartesiaOptions.language != null) {
        formData.set('language', cartesiaOptions.language);
      }
      if (cartesiaOptions.timestampGranularities != null) {
        for (const granularity of cartesiaOptions.timestampGranularities) {
          formData.append('timestamp_granularities[]', granularity);
        }
      }
    }

    return {
      formData,
      warnings,
    };
  }

  async doGenerate(
    options: Parameters<TranscriptionModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<TranscriptionModelV4['doGenerate']>>> {
    if (isStreamingTranscriptionModelId(this.modelId)) {
      throw new UnsupportedFunctionalityError({
        functionality: `non-streaming transcription with ${this.modelId}`,
      });
    }

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { formData, warnings } = await this.getArgs(options);

    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse,
    } = await postFormDataToApi({
      url: this.config.url({
        path: '/stt',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      formData,
      failedResponseHandler: cartesiaFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        cartesiaTranscriptionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    return {
      text: response.text,
      segments:
        response.words?.map(word => ({
          text: word.word,
          startSecond: word.start,
          endSecond: word.end,
        })) ?? [],
      language: response.language ?? undefined,
      durationInSeconds: response.duration ?? undefined,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse,
      },
    };
  }

  async doStream(
    options: TranscriptionModelV4StreamOptions,
  ): Promise<
    Awaited<ReturnType<NonNullable<TranscriptionModelV4['doStream']>>>
  > {
    if (!isStreamingTranscriptionModelId(this.modelId)) {
      throw new UnsupportedFunctionalityError({
        functionality: `streaming transcription with ${this.modelId}`,
      });
    }

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const warnings: SharedV4Warning[] = [];
    const cartesiaOptions = await parseProviderOptions({
      provider: 'cartesia',
      providerOptions: options.providerOptions,
      schema: cartesiaTranscriptionModelOptionsSchema,
    });

    if (
      cartesiaOptions?.language != null &&
      cartesiaOptions.language !== 'en'
    ) {
      throw new InvalidArgumentError({
        argument: 'providerOptions',
        message: 'Cartesia Ink 2 currently supports English only.',
      });
    }

    if (cartesiaOptions?.timestampGranularities != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'providerOptions.cartesia.timestampGranularities',
        details:
          'Cartesia streaming transcription does not support timestamp granularities.',
      });
    }

    const token = await this.createStreamingAccessToken(options);
    const useTurnDetection =
      cartesiaOptions?.streaming?.turnDetection !== false;
    const url = buildCartesiaStreamingTranscriptionUrl({
      baseURL: this.config.url({ path: '/', modelId: this.modelId }),
      version: this.config.version ?? '2026-03-01',
      modelId: this.modelId,
      inputAudioFormat: options.inputAudioFormat,
      providerOptions: cartesiaOptions,
      token,
      useTurnDetection,
    });
    const requestUrl = new URL(url);
    requestUrl.searchParams.delete('access_token');

    return {
      request: { body: requestUrl.toString() },
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
      },
      stream: createCartesiaStreamingTranscriptionStream({
        webSocket: this.config.webSocket,
        url,
        warnings,
        language: cartesiaOptions?.language ?? 'en',
        useTurnDetection,
        audio: options.audio,
        abortSignal: options.abortSignal,
        includeRawChunks: options.includeRawChunks,
      }),
    };
  }

  private async createStreamingAccessToken(
    options: TranscriptionModelV4StreamOptions,
  ): Promise<string> {
    const { value } = await postJsonToApi({
      url: this.config.url({ path: '/access-token', modelId: this.modelId }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: { grants: { stt: true } },
      failedResponseHandler: cartesiaFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        cartesiaAccessTokenResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    return value.token;
  }
}

function createCartesiaStreamingTranscriptionStream({
  webSocket,
  url,
  warnings,
  language,
  useTurnDetection,
  audio,
  abortSignal,
  includeRawChunks,
}: {
  webSocket: CartesiaConfig['webSocket'];
  url: URL;
  warnings: SharedV4Warning[];
  language: string;
  useTurnDetection: boolean;
  audio: ReadableStream<Uint8Array | string>;
  abortSignal: AbortSignal | undefined;
  includeRawChunks: boolean | undefined;
}): ReadableStream<TranscriptionModelV4StreamPart> {
  let finished = false;
  let cleanup: (closeCode?: number) => void = () => {};

  return new ReadableStream({
    start: controller => {
      const finalTexts: string[] = [];
      let durationInSeconds = 0;
      let audioReader:
        | ReadableStreamDefaultReader<Uint8Array | string>
        | undefined;
      let connection: WebSocketConnection | undefined;

      cleanup = (closeCode?: number) => {
        if (audioReader != null) {
          void audioReader.cancel().catch(() => {});
        } else {
          // Pre-open failure or abort: cancel the caller's audio stream so an
          // upstream producer piping into it does not hang.
          void audio.cancel().catch(() => {});
        }
        connection?.close(closeCode);
      };

      const finishWithError = (error: unknown) => {
        if (finished) return;
        finished = true;
        cleanup();
        controller.error(error);
      };

      const finish = () => {
        if (finished) return;
        finished = true;
        controller.enqueue({
          type: 'finish',
          text: finalTexts.join(useTurnDetection ? ' ' : ''),
          segments: [],
          language,
          ...(durationInSeconds > 0 ? { durationInSeconds } : {}),
        });
        controller.close();
        cleanup(1000);
      };

      const sendAudio = async (socket: WebSocketLike) => {
        audioReader = audio.getReader();
        try {
          while (true) {
            const { done, value } = await audioReader.read();
            if (done || finished) break;
            socket.send(
              value instanceof Uint8Array
                ? value
                : convertBase64ToUint8Array(value),
            );
            await waitForWebSocketBufferDrain(socket);
          }
        } finally {
          audioReader.releaseLock();
          audioReader = undefined;
        }

        if (!finished) {
          socket.send(
            useTurnDetection ? JSON.stringify({ type: 'close' }) : 'finalize',
          );
        }
      };

      connection = connectToWebSocket({
        url,
        webSocket,
        abortSignal,
        onAbort: finishWithError,
        onProcessingError: finishWithError,
        onOpen: socket => {
          controller.enqueue({ type: 'stream-start', warnings });
          void sendAudio(socket).catch(finishWithError);
        },
        onMessageText: async text => {
          const parsed = await safeParseJSON({ text });
          if (!parsed.success) return;
          const raw = parsed.value as CartesiaStreamingTranscriptionEvent;

          if (includeRawChunks) {
            controller.enqueue({ type: 'raw', rawValue: raw });
          }

          switch (raw.type) {
            case 'turn.update':
            case 'turn.eager_end': {
              controller.enqueue({
                type: 'transcript-partial',
                id: raw.request_id,
                text: raw.transcript ?? '',
              });
              break;
            }

            case 'turn.end': {
              const text = raw.transcript ?? '';
              finalTexts.push(text);
              controller.enqueue({
                type: 'transcript-final',
                id: raw.request_id,
                text,
              });
              break;
            }

            case 'transcript': {
              const transcript = raw.text ?? '';
              if (raw.is_final === true) {
                finalTexts.push(transcript);
                durationInSeconds += raw.duration ?? 0;
                controller.enqueue({
                  type: 'transcript-final',
                  id: raw.request_id,
                  text: transcript,
                });
              } else {
                controller.enqueue({
                  type: 'transcript-partial',
                  id: raw.request_id,
                  text: transcript,
                  ...(raw.duration != null
                    ? { durationInSeconds: raw.duration }
                    : {}),
                });
              }
              break;
            }

            case 'flush_done': {
              connection?.socket?.send('close');
              break;
            }

            case 'done': {
              finish();
              break;
            }

            case 'error': {
              finishWithError(
                new Error(
                  raw.message ??
                    raw.error_code ??
                    'Cartesia streaming transcription error',
                ),
              );
              break;
            }
          }
        },
        onSocketError: () => {
          finishWithError(new Error('Cartesia streaming transcription error'));
        },
        onClose: () => {
          if (!finished) finish();
        },
      });
    },

    cancel: () => {
      if (finished) return;
      finished = true;
      cleanup();
    },
  });
}

function buildCartesiaStreamingTranscriptionUrl({
  baseURL,
  version,
  modelId,
  inputAudioFormat,
  providerOptions,
  token,
  useTurnDetection,
}: {
  baseURL: string;
  version: string;
  modelId: string;
  inputAudioFormat: TranscriptionModelV4StreamOptions['inputAudioFormat'];
  providerOptions: CartesiaTranscriptionModelOptions | undefined;
  token: string;
  useTurnDetection: boolean;
}) {
  const url = toWebSocketUrl(
    new URL(
      useTurnDetection ? '/stt/turns/websocket' : '/stt/websocket',
      baseURL,
    ),
  );
  url.searchParams.set('model', modelId);
  url.searchParams.set(
    'encoding',
    cartesiaEncodingFromInputAudioFormat(inputAudioFormat.type),
  );
  url.searchParams.set('sample_rate', String(inputAudioFormat.rate ?? 24000));
  url.searchParams.set('cartesia_version', version);
  url.searchParams.set('access_token', token);
  if (!useTurnDetection && providerOptions?.language != null) {
    url.searchParams.set('language', providerOptions.language);
  }
  return url;
}

function cartesiaEncodingFromInputAudioFormat(type: string): string {
  switch (type) {
    case 'audio/pcm':
      return 'pcm_s16le';
    case 'audio/pcmu':
      return 'pcm_mulaw';
    case 'audio/pcma':
      return 'pcm_alaw';
    default:
      throw new InvalidArgumentError({
        argument: 'inputAudioFormat',
        message: `Unsupported Cartesia streaming audio format: ${type}`,
      });
  }
}

function isStreamingTranscriptionModelId(modelId: string): boolean {
  return modelId === 'ink-2' || modelId.startsWith('ink-2-');
}

const cartesiaTranscriptionResponseSchema = z.object({
  text: z.string(),
  language: z.string().nullish(),
  duration: z.number().nullish(),
  words: z
    .array(
      z.object({
        word: z.string(),
        start: z.number(),
        end: z.number(),
      }),
    )
    .nullish(),
});

const cartesiaAccessTokenResponseSchema = z.object({
  token: z.string().min(1),
});
