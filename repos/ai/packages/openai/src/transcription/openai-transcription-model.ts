import {
  UnsupportedFunctionalityError,
  type Experimental_TranscriptionModelV4StreamOptions as TranscriptionModelV4StreamOptions,
  type SharedV4Warning,
  type TranscriptionModelV4,
  type TranscriptionModelV4CallOptions,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  convertToBase64,
  createJsonResponseHandler,
  connectToWebSocket,
  mediaTypeToExtension,
  parseProviderOptions,
  postFormDataToApi,
  safeParseJSON,
  serializeModelOptions,
  toWebSocketUrl,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
  waitForWebSocketBufferDrain,
  type WebSocketConnection,
  type WebSocketLike,
} from '@ai-sdk/provider-utils';
import type { OpenAIConfig } from '../openai-config';
import { openaiFailedResponseHandler } from '../openai-error';
import { openaiTranscriptionResponseSchema } from './openai-transcription-api';
import {
  openAITranscriptionModelOptions,
  type OpenAITranscriptionModelId,
  type OpenAITranscriptionModelOptions,
} from './openai-transcription-model-options';
export type OpenAITranscriptionCallOptions = Omit<
  TranscriptionModelV4CallOptions,
  'providerOptions'
> & {
  providerOptions?: {
    openai?: OpenAITranscriptionModelOptions;
  };
};

export type OpenAITranscriptionStreamOptions = Omit<
  TranscriptionModelV4StreamOptions,
  'providerOptions'
> & {
  providerOptions?: {
    openai?: OpenAITranscriptionModelOptions;
  };
};

type OpenAIRealtimeTranscriptionEvent = {
  type?: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
};

/**
 * Realtime transcription model IDs stream over the realtime WebSocket
 * and do not support the REST transcription endpoint. Prefix matching
 * keeps dated snapshots (e.g. `gpt-realtime-whisper-2026-01-01`) working.
 */
function isRealtimeTranscriptionModelId(modelId: string): boolean {
  return (
    modelId === 'gpt-realtime-whisper' ||
    modelId.startsWith('gpt-realtime-whisper-')
  );
}

interface OpenAITranscriptionModelConfig extends OpenAIConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

// https://platform.openai.com/docs/guides/speech-to-text#supported-languages
const languageMap = {
  afrikaans: 'af',
  arabic: 'ar',
  armenian: 'hy',
  azerbaijani: 'az',
  belarusian: 'be',
  bosnian: 'bs',
  bulgarian: 'bg',
  catalan: 'ca',
  chinese: 'zh',
  croatian: 'hr',
  czech: 'cs',
  danish: 'da',
  dutch: 'nl',
  english: 'en',
  estonian: 'et',
  finnish: 'fi',
  french: 'fr',
  galician: 'gl',
  german: 'de',
  greek: 'el',
  hebrew: 'he',
  hindi: 'hi',
  hungarian: 'hu',
  icelandic: 'is',
  indonesian: 'id',
  italian: 'it',
  japanese: 'ja',
  kannada: 'kn',
  kazakh: 'kk',
  korean: 'ko',
  latvian: 'lv',
  lithuanian: 'lt',
  macedonian: 'mk',
  malay: 'ms',
  marathi: 'mr',
  maori: 'mi',
  nepali: 'ne',
  norwegian: 'no',
  persian: 'fa',
  polish: 'pl',
  portuguese: 'pt',
  romanian: 'ro',
  russian: 'ru',
  serbian: 'sr',
  slovak: 'sk',
  slovenian: 'sl',
  spanish: 'es',
  swahili: 'sw',
  swedish: 'sv',
  tagalog: 'tl',
  tamil: 'ta',
  thai: 'th',
  turkish: 'tr',
  ukrainian: 'uk',
  urdu: 'ur',
  vietnamese: 'vi',
  welsh: 'cy',
};

export class OpenAITranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';

  static [WORKFLOW_SERIALIZE](model: OpenAITranscriptionModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: OpenAITranscriptionModelId;
    config: OpenAITranscriptionModelConfig;
  }) {
    return new OpenAITranscriptionModel(options.modelId, options.config);
  }

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: OpenAITranscriptionModelId,
    private readonly config: OpenAITranscriptionModelConfig,
  ) {}

  private async getArgs({
    audio,
    mediaType,
    providerOptions,
  }: OpenAITranscriptionCallOptions) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const openAIOptions = await parseProviderOptions({
      provider: 'openai',
      providerOptions,
      schema: openAITranscriptionModelOptions,
    });

    // Create form data with base fields
    const formData = new FormData();
    const blob =
      audio instanceof Uint8Array
        ? new Blob([audio])
        : new Blob([convertBase64ToUint8Array(audio)]);

    formData.append('model', this.modelId);
    const fileExtension = mediaTypeToExtension(mediaType);
    formData.append(
      'file',
      new File([blob], 'audio', { type: mediaType }),
      `audio.${fileExtension}`,
    );

    if (this.modelId === 'whisper-1') {
      formData.append('response_format', 'verbose_json');
    }

    // Add provider-specific options
    if (openAIOptions) {
      const isGpt4oTranscribeModel = [
        'gpt-4o-transcribe',
        'gpt-4o-mini-transcribe',
      ].includes(this.modelId);

      const transcriptionModelOptions = {
        include: openAIOptions.include,
        language: openAIOptions.language,
        prompt: openAIOptions.prompt,
        // https://platform.openai.com/docs/api-reference/audio/createTranscription#audio_createtranscription-response_format
        // prefer verbose_json to get segments for models that support it
        ...(this.modelId !== 'whisper-1' && {
          response_format: isGpt4oTranscribeModel ? 'json' : 'verbose_json',
        }),
        temperature: openAIOptions.temperature,
        timestamp_granularities: openAIOptions.timestampGranularities,
      };

      for (const [key, value] of Object.entries(transcriptionModelOptions)) {
        if (value != null) {
          if (Array.isArray(value)) {
            for (const item of value) {
              formData.append(`${key}[]`, String(item));
            }
          } else {
            formData.append(key, String(value));
          }
        }
      }
    }

    return {
      formData,
      warnings,
    };
  }

  async doGenerate(
    options: OpenAITranscriptionCallOptions,
  ): Promise<Awaited<ReturnType<TranscriptionModelV4['doGenerate']>>> {
    if (isRealtimeTranscriptionModelId(this.modelId)) {
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
        path: '/audio/transcriptions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      formData,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiTranscriptionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const language =
      response.language != null && response.language in languageMap
        ? languageMap[response.language as keyof typeof languageMap]
        : undefined;

    return {
      text: response.text,
      segments:
        response.segments?.map(segment => ({
          text: segment.text,
          startSecond: segment.start,
          endSecond: segment.end,
        })) ??
        response.words?.map(word => ({
          text: word.word,
          startSecond: word.start,
          endSecond: word.end,
        })) ??
        [],
      language,
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
    options: OpenAITranscriptionStreamOptions,
  ): Promise<
    Awaited<ReturnType<NonNullable<TranscriptionModelV4['doStream']>>>
  > {
    if (!isRealtimeTranscriptionModelId(this.modelId)) {
      throw new UnsupportedFunctionalityError({
        functionality: `streaming transcription with ${this.modelId}`,
      });
    }

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const openAIOptions = await parseProviderOptions({
      provider: 'openai',
      providerOptions: options.providerOptions,
      schema: openAITranscriptionModelOptions,
    });
    const warnings: SharedV4Warning[] = [];

    // options that only apply to the REST transcription endpoint
    // (checked on the raw options because some have schema defaults):
    const rawOpenAIOptions = options.providerOptions?.openai ?? {};
    for (const option of [
      'include',
      'prompt',
      'temperature',
      'timestampGranularities',
    ]) {
      if (rawOpenAIOptions[option as keyof typeof rawOpenAIOptions] != null) {
        warnings.push({
          type: 'unsupported',
          feature: `providerOptions.openai.${option}`,
          details: `OpenAI streaming transcription does not support ${option}.`,
        });
      }
    }

    const headers = combineHeaders(this.config.headers?.(), options.headers);
    const sessionUpdate = buildOpenAIRealtimeTranscriptionSession({
      modelId: this.modelId,
      inputAudioFormat: options.inputAudioFormat,
      providerOptions: openAIOptions,
    });

    return {
      request: { body: sessionUpdate },
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
      },
      stream: createOpenAIRealtimeTranscriptionStream({
        webSocket: this.config.webSocket,
        url: toWebSocketUrl(
          this.config.url({
            path: '/realtime?intent=transcription',
            modelId: this.modelId,
          }),
        ),
        headers,
        sessionUpdate,
        language: openAIOptions?.language,
        warnings,
        audio: options.audio,
        abortSignal: options.abortSignal,
        includeRawChunks: options.includeRawChunks,
      }),
    };
  }
}

function createOpenAIRealtimeTranscriptionStream({
  webSocket,
  url,
  headers,
  sessionUpdate,
  language,
  warnings,
  audio,
  abortSignal,
  includeRawChunks,
}: {
  webSocket: OpenAIConfig['webSocket'];
  url: URL;
  headers: Record<string, string | undefined>;
  sessionUpdate: unknown;
  language: string | undefined;
  warnings: SharedV4Warning[];
  audio: ReadableStream<Uint8Array | string>;
  abortSignal: AbortSignal | undefined;
  includeRawChunks: boolean | undefined;
}) {
  let finished = false;
  let cleanup: (closeCode?: number) => void = () => {};

  return new ReadableStream({
    start: controller => {
      const realtimeConnection = getOpenAIRealtimeConnection(headers);
      let audioReader:
        | ReadableStreamDefaultReader<Uint8Array | string>
        | undefined;
      let connection: WebSocketConnection | undefined;

      cleanup = (closeCode?: number) => {
        if (audioReader != null) {
          void audioReader.cancel().catch(() => {});
        } else {
          // pre-open failure or abort: cancel the caller's audio stream so an
          // upstream producer piping into it does not hang:
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

      const finish = (text: string, id?: string) => {
        if (finished) return;
        finished = true;
        if (id != null) {
          controller.enqueue({ type: 'transcript-final', id, text });
        }
        controller.enqueue({
          type: 'finish',
          text,
          segments: [],
          language,
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
              JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: convertToBase64(value),
              }),
            );
            // backpressure: pause reads while the socket buffer is full
            await waitForWebSocketBufferDrain(socket);
          }
        } finally {
          audioReader.releaseLock();
          // unlocked again: cleanup must cancel `audio`, not the reader
          audioReader = undefined;
        }
        if (!finished) {
          socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        }
      };

      connection = connectToWebSocket({
        url,
        protocols: realtimeConnection.protocols,
        headers: realtimeConnection.headers,
        webSocket,
        abortSignal,
        onAbort: finishWithError,
        onProcessingError: finishWithError,
        onOpen: socket => {
          controller.enqueue({ type: 'stream-start', warnings });
          socket.send(JSON.stringify(sessionUpdate));
          void sendAudio(socket).catch(finishWithError);
        },
        onMessageText: async text => {
          const parsed = await safeParseJSON({ text });
          if (!parsed.success) return;
          const raw = parsed.value as OpenAIRealtimeTranscriptionEvent;

          if (includeRawChunks) {
            controller.enqueue({ type: 'raw', rawValue: raw });
          }

          switch (raw.type) {
            case 'conversation.item.input_audio_transcription.delta': {
              controller.enqueue({
                type: 'transcript-delta',
                id: raw.item_id,
                delta: raw.delta ?? '',
              });
              break;
            }

            case 'conversation.item.input_audio_transcription.completed': {
              finish(raw.transcript ?? '', raw.item_id);
              break;
            }

            case 'error': {
              finishWithError(
                new Error(raw.error?.message ?? 'OpenAI realtime error'),
              );
              break;
            }
          }
        },
        onSocketError: () => {
          finishWithError(new Error('OpenAI realtime transcription error'));
        },
        onClose: () => {
          if (finished) return;
          finished = true;
          cleanup();
          controller.close();
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

function buildOpenAIRealtimeTranscriptionSession({
  modelId,
  inputAudioFormat,
  providerOptions,
}: {
  modelId: string;
  inputAudioFormat: TranscriptionModelV4StreamOptions['inputAudioFormat'];
  providerOptions: OpenAITranscriptionModelOptions | undefined;
}) {
  return {
    type: 'session.update',
    session: {
      type: 'transcription',
      audio: {
        input: {
          format: {
            type: inputAudioFormat.type,
            ...(inputAudioFormat.rate != null
              ? { rate: inputAudioFormat.rate }
              : {}),
          },
          transcription: {
            model: modelId,
            ...(providerOptions?.language != null
              ? { language: providerOptions.language }
              : {}),
            ...(providerOptions?.streaming?.delay != null
              ? { delay: providerOptions.streaming.delay }
              : {}),
          },
          turn_detection: null,
        },
      },
      ...(providerOptions?.streaming?.include != null
        ? { include: providerOptions.streaming.include }
        : {}),
    },
  };
}

// The bearer token rides the `openai-insecure-api-key` subprotocol (native
// `WebSocket` cannot send headers) and the Authorization header is stripped:
// OpenAI rejects handshakes that send both auth channels.
function getOpenAIRealtimeConnection(
  headers: Record<string, string | undefined>,
): {
  protocols: string[];
  headers: Record<string, string | undefined>;
} {
  // last case-variant wins: combineHeaders keeps case-distinct keys and
  // spreads per-call headers after configuration headers
  let authorization: string | undefined;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'authorization' && value != null) {
      authorization = value;
    }
  }
  // the HTTP auth scheme is case-insensitive
  const token = authorization?.match(/^bearer\s+(.+)$/i)?.[1];

  if (token == null) {
    return { protocols: ['realtime'], headers };
  }

  return {
    protocols: ['realtime', `openai-insecure-api-key.${token}`],
    headers: Object.fromEntries(
      Object.entries(headers).filter(
        ([key]) => key.toLowerCase() !== 'authorization',
      ),
    ),
  };
}
