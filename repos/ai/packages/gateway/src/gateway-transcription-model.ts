import {
  getErrorMessage,
  type Experimental_TranscriptionModelV4StreamOptions as TranscriptionModelV4StreamOptions,
  type Experimental_TranscriptionModelV4StreamPart as TranscriptionModelV4StreamPart,
  type Experimental_TranscriptionModelV4StreamResult as TranscriptionModelV4StreamResult,
  type SharedV4ProviderMetadata,
  type SharedV4Warning,
  type TranscriptionModelV4,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  convertUint8ArrayToBase64,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  connectToWebSocket,
  normalizeHeaders,
  experimental_parseTranscriptionStreamPart as parseTranscriptionStreamPart,
  postJsonToApi,
  resolve,
  EXPERIMENTAL_TRANSCRIPTION_STREAM_AUDIO_DONE_FRAME_TYPE as TRANSCRIPTION_STREAM_AUDIO_DONE_FRAME_TYPE,
  waitForWebSocketBufferDrain,
  EXPERIMENTAL_TRANSCRIPTION_STREAM_START_FRAME_TYPE as TRANSCRIPTION_STREAM_START_FRAME_TYPE,
  type Experimental_TranscriptionStreamStartFrame,
  type Resolvable,
  type WebSocketConnection,
  type WebSocketConstructor,
  type WebSocketLike,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { asGatewayError, createGatewayErrorFromResponse } from './errors';
import { parseAuthMethod } from './errors/parse-auth-method';
import type { GatewayConfig } from './gateway-config';
import { VERCEL_AI_GATEWAY_TEAM_HEADER } from './gateway-headers';
import {
  GATEWAY_TRANSCRIPTION_SUBPROTOCOL,
  getGatewayTranscriptionProtocols,
} from './gateway-realtime-auth';

export class GatewayTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4' as const;

  constructor(
    readonly modelId: string,
    private readonly config: GatewayConfig & {
      provider: string;
      o11yHeaders: Resolvable<Record<string, string>>;
      _internal?: {
        currentDate?: () => Date;
      };
    },
  ) {}

  get provider(): string {
    return this.config.provider;
  }

  async doGenerate({
    audio,
    mediaType,
    providerOptions,
    headers,
    abortSignal,
  }: Parameters<TranscriptionModelV4['doGenerate']>[0]): Promise<
    Awaited<ReturnType<TranscriptionModelV4['doGenerate']>>
  > {
    const resolvedHeaders = this.config.headers
      ? await resolve(this.config.headers)
      : undefined;
    try {
      const {
        responseHeaders,
        value: responseBody,
        rawValue,
      } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(
          resolvedHeaders,
          headers ?? {},
          this.getModelConfigHeaders(),
          await resolve(this.config.o11yHeaders),
        ),
        body: {
          audio:
            audio instanceof Uint8Array
              ? convertUint8ArrayToBase64(audio)
              : audio,
          mediaType,
          ...(providerOptions && { providerOptions }),
        },
        successfulResponseHandler: createJsonResponseHandler(
          gatewayTranscriptionResponseSchema,
        ),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: data => data,
        }),
        ...(abortSignal && { abortSignal }),
        fetch: this.config.fetch,
      });

      return {
        text: responseBody.text,
        segments: responseBody.segments ?? [],
        language: responseBody.language ?? undefined,
        durationInSeconds: responseBody.durationInSeconds ?? undefined,
        warnings: (responseBody.warnings ?? []) as Array<SharedV4Warning>,
        providerMetadata:
          responseBody.providerMetadata as SharedV4ProviderMetadata,
        response: {
          timestamp: new Date(),
          modelId: this.modelId,
          headers: responseHeaders,
          body: rawValue,
        },
      };
    } catch (error) {
      throw await asGatewayError(
        error,
        await parseAuthMethod(resolvedHeaders ?? {}),
      );
    }
  }

  async doStream(
    options: TranscriptionModelV4StreamOptions,
  ): Promise<TranscriptionModelV4StreamResult> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();

    const headers = combineHeaders(
      await resolve(this.config.headers ?? {}),
      options.headers ?? {},
      this.getModelConfigHeaders(),
      await resolve(this.config.o11yHeaders),
    );
    const authMethod = await parseAuthMethod(headers);

    // First frame after the WebSocket opens, per the transcription-stream
    // envelope. Optional keys are omitted so the frame stays minimal.
    const startFrame: Experimental_TranscriptionStreamStartFrame = {
      type: TRANSCRIPTION_STREAM_START_FRAME_TYPE,
      inputAudioFormat: options.inputAudioFormat,
      ...(options.providerOptions != null && {
        providerOptions: options.providerOptions,
      }),
      ...(options.includeRawChunks != null && {
        includeRawChunks: options.includeRawChunks,
      }),
    };

    return {
      stream: createGatewayTranscriptionStream({
        webSocket: this.config.webSocket,
        url: toGatewayTranscriptionUrl(this.config.baseURL, this.modelId),
        protocols: getProtocolsFromHeaders(headers),
        headers,
        startFrame,
        audio: options.audio,
        abortSignal: options.abortSignal,
        authMethod,
      }),
      request: { body: startFrame },
      response: { timestamp: currentDate, modelId: this.modelId },
    };
  }

  private getUrl() {
    return `${this.config.baseURL}/transcription-model`;
  }

  private getModelConfigHeaders() {
    return {
      'ai-transcription-model-specification-version': '4',
      'ai-model-id': this.modelId,
    };
  }
}

/**
 * Gateway streaming transcription WebSocket URL: HTTP(S) base upgraded to
 * WS(S), model id in `?ai-model-id=` (browser `WebSocket` cannot set headers;
 * slash-safe for qualified ids like `openai/gpt-realtime-whisper`).
 */
export function toGatewayTranscriptionUrl(
  baseURL: string,
  modelId: string,
): string {
  const url = new URL(`${baseURL.replace(/^http/, 'ws')}/transcription-model`);
  url.searchParams.set('ai-model-id', modelId);
  return url.toString();
}

/**
 * Auth-carrying subprotocols from the resolved request headers (bearer token
 * + optional team scope). Native `WebSocket` cannot send headers, so auth
 * rides the `Sec-WebSocket-Protocol` handshake. Header lookups are
 * case-insensitive because `combineHeaders` does not normalize casing and
 * callers can pass arbitrary casing via the `headers` option.
 */
function getProtocolsFromHeaders(
  headers: Record<string, string | undefined>,
): string[] {
  const normalizedHeaders = normalizeHeaders(headers);
  const authorization = normalizedHeaders.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined;

  return token == null
    ? [GATEWAY_TRANSCRIPTION_SUBPROTOCOL]
    : getGatewayTranscriptionProtocols(token, {
        teamIdOrSlug: normalizedHeaders[VERCEL_AI_GATEWAY_TEAM_HEADER],
      });
}

/** Audio frames stay under server frame-size limits (envelope rule 7). */
const MAX_AUDIO_FRAME_BYTES = 64 * 1024;

function createGatewayTranscriptionStream({
  webSocket,
  url,
  protocols,
  headers,
  startFrame,
  audio,
  abortSignal,
  authMethod,
}: {
  webSocket: WebSocketConstructor | undefined;
  url: string;
  protocols: string[];
  headers: Record<string, string | undefined>;
  startFrame: Experimental_TranscriptionStreamStartFrame;
  audio: ReadableStream<Uint8Array | string>;
  abortSignal: AbortSignal | undefined;
  authMethod: 'api-key' | 'oidc' | undefined;
}): ReadableStream<TranscriptionModelV4StreamPart> {
  let finished = false;
  let cleanup: (closeCode?: number) => void = () => {};

  return new ReadableStream<TranscriptionModelV4StreamPart>({
    start: controller => {
      let audioReader:
        | ReadableStreamDefaultReader<Uint8Array | string>
        | undefined;
      let hasServerErrorPart = false;
      let lastServerError: unknown;
      let audioStopped = false;
      let connection: WebSocketConnection | undefined;

      cleanup = (closeCode?: number) => {
        if (audioReader != null) {
          void audioReader.cancel().catch(() => {});
        } else {
          // Pre-open failure or abort: `sendAudio` never took a reader, so
          // cancel the caller's audio stream directly — otherwise an upstream
          // producer piping into it hangs.
          void audio.cancel().catch(() => {});
        }
        connection?.close(closeCode);
      };

      const stopAudio = () => {
        audioStopped = true;
        if (audioReader != null) {
          void audioReader.cancel().catch(() => {});
          audioReader = undefined;
        } else {
          void audio.cancel().catch(() => {});
        }
      };

      const finishWithError = (error: unknown) => {
        if (finished) return;
        finished = true;
        cleanup();
        void errorControllerWithGatewayError(controller, error, authMethod);
      };

      const sendAudio = async (socket: WebSocketLike) => {
        const reader = audio.getReader();
        audioReader = reader;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || finished) break;
            // Binary frames; base64 string chunks are decoded first. Caller
            // chunks are split to stay under server frame-size limits
            // (envelope rule 7), with backpressure between frames.
            const bytes =
              typeof value === 'string'
                ? convertBase64ToUint8Array(value)
                : value;
            for (
              let offset = 0;
              offset < bytes.length;
              offset += MAX_AUDIO_FRAME_BYTES
            ) {
              if (finished) break;
              socket.send(
                bytes.subarray(offset, offset + MAX_AUDIO_FRAME_BYTES),
              );
              await waitForWebSocketBufferDrain(socket);
            }
          }
        } finally {
          reader.releaseLock();
          // unlocked again: cleanup must cancel `audio`, not the reader
          if (audioReader === reader) {
            audioReader = undefined;
          }
        }
        if (!finished && !audioStopped) {
          socket.send(
            JSON.stringify({
              type: TRANSCRIPTION_STREAM_AUDIO_DONE_FRAME_TYPE,
            }),
          );
        }
      };

      connection = connectToWebSocket({
        url,
        protocols,
        headers,
        webSocket,
        abortSignal,
        onAbort: reason => {
          if (finished) return;
          finished = true;
          cleanup();
          controller.error(reason);
        },
        onProcessingError: finishWithError,
        onOpen: socket => {
          socket.send(JSON.stringify(startFrame));
          void sendAudio(socket).catch(finishWithError);
        },
        // Server frames are envelope-serialized stream parts; the codec
        // handles parsing, unknown-part skipping, and timestamp revival.
        onMessageText: text => {
          if (finished) return;
          const part = parseTranscriptionStreamPart(text);
          if (part == null) return;
          if (part.type === 'finish') {
            finished = true;
            controller.enqueue(part);
            controller.close();
            cleanup(1000);
            return;
          }

          if (part.type === 'error') {
            // Remembered so the terminal close error (the server closes
            // non-1000 after an error part) surfaces the server's message
            // to promise-based consumers.
            hasServerErrorPart = true;
            lastServerError = part.error;
            // envelope rule 5: error parts are terminal — stop sending audio
            // while the server holds the connection open (e.g. for its final
            // billing flush)
            stopAudio();
          }

          controller.enqueue(part);
        },
        onSocketError: () => {
          finishWithError(
            new Error('Connection error on AI Gateway transcription stream'),
          );
        },
        onClose: () => {
          if (hasServerErrorPart) {
            if (finished) return;
            void createErrorFromServerErrorPart(
              lastServerError,
              authMethod,
            ).then(finishWithError);
            return;
          }
          finishWithError(
            new Error(
              'AI Gateway transcription stream closed before a finish part was received',
            ),
          );
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

const providerMetadataEntrySchema = z.object({}).catchall(z.unknown());

const gatewayTranscriptionWarningSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('unsupported'),
    feature: z.string(),
    details: z.string().optional(),
  }),
  z.object({
    type: z.literal('compatibility'),
    feature: z.string(),
    details: z.string().optional(),
  }),
  z.object({
    type: z.literal('deprecated'),
    setting: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('other'),
    message: z.string(),
  }),
]);

const gatewayTranscriptionResponseSchema = z.object({
  text: z.string(),
  segments: z
    .array(
      z.object({
        text: z.string(),
        startSecond: z.number(),
        endSecond: z.number(),
      }),
    )
    .optional(),
  language: z.string().nullish(),
  durationInSeconds: z.number().nullish(),
  warnings: z.array(gatewayTranscriptionWarningSchema).optional(),
  providerMetadata: z
    .record(z.string(), providerMetadataEntrySchema)
    .optional(),
});

/**
 * `asGatewayError` is async while the WebSocket event handlers are
 * synchronous, hence this helper.
 */
async function errorControllerWithGatewayError(
  controller: ReadableStreamDefaultController<TranscriptionModelV4StreamPart>,
  error: unknown,
  authMethod: 'api-key' | 'oidc' | undefined,
): Promise<void> {
  controller.error(await asGatewayError(error, authMethod));
}

/**
 * Extract a human-readable message from an `error` stream part's payload for
 * the terminal close error.
 */
function getServerErrorMessage(error: unknown): string {
  if (
    error != null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  // JSON-stringifies object payloads (`String` would yield '[object Object]').
  return getErrorMessage(error);
}

/** Canonical status codes for server error-part types (no HTTP status exists on the WebSocket). */
const SERVER_ERROR_STATUS_CODES: Record<string, number> = {
  authentication_error: 401,
  failed_dependency: 424,
  forbidden: 403,
  internal_server_error: 500,
  invalid_request_error: 400,
  model_not_found: 404,
  rate_limit_exceeded: 429,
};

/**
 * Maps a server error-part payload (`{ message, type }`) to the public
 * Gateway error class for its type; unknown shapes keep the generic message.
 */
async function createErrorFromServerErrorPart(
  error: unknown,
  authMethod: 'api-key' | 'oidc' | undefined,
): Promise<unknown> {
  if (
    typeof error === 'object' &&
    error != null &&
    'message' in error &&
    typeof error.message === 'string' &&
    'type' in error &&
    typeof error.type === 'string' &&
    error.type in SERVER_ERROR_STATUS_CODES
  ) {
    return createGatewayErrorFromResponse({
      response: { error: { message: error.message, type: error.type } },
      statusCode: SERVER_ERROR_STATUS_CODES[error.type],
      authMethod,
    });
  }
  return new Error(
    `AI Gateway transcription stream failed: ${getServerErrorMessage(error)}`,
  );
}
