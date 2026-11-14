import type {
  Experimental_RealtimeModelV4 as RealtimeModelV4,
  Experimental_RealtimeModelV4ClientEvent as RealtimeModelV4ClientEvent,
  Experimental_RealtimeModelV4ClientSecretOptions as RealtimeModelV4ClientSecretOptions,
  Experimental_RealtimeModelV4ClientSecretResult as RealtimeModelV4ClientSecretResult,
  Experimental_RealtimeModelV4ServerEvent as RealtimeModelV4ServerEvent,
  Experimental_RealtimeModelV4SessionConfig as RealtimeModelV4SessionConfig,
} from '@ai-sdk/provider';
import {
  convertBase64ToUint8Array,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import type { CartesiaRealtimeModelId } from './cartesia-realtime-model-options';

export type CartesiaRealtimeModelConfig = {
  provider: string;
  baseURL: string;
  version: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
};

type CartesiaRealtimeWireEvent = {
  type: string;
  request_id?: string;
  transcript?: string;
  text?: string;
  is_final?: boolean;
  duration?: number;
  message?: string;
  error_code?: string;
};

type ManualTranscriptState = {
  duration: number;
  events: CartesiaRealtimeWireEvent[];
  text: string;
};

/**
 * Realtime Ink model using Cartesia's STT WebSocket APIs.
 */
export class CartesiaRealtimeModel implements RealtimeModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider: string;
  readonly modelId: CartesiaRealtimeModelId;

  private readonly config: CartesiaRealtimeModelConfig;
  private manualTranscript: ManualTranscriptState = {
    duration: 0,
    events: [],
    text: '',
  };
  private sessionCreated = false;
  private useTurnDetection = true;

  constructor(
    modelId: CartesiaRealtimeModelId,
    config: CartesiaRealtimeModelConfig,
  ) {
    this.modelId = modelId;
    this.provider = config.provider;
    this.config = config;
  }

  async doCreateClientSecret(
    options: RealtimeModelV4ClientSecretOptions,
  ): Promise<RealtimeModelV4ClientSecretResult> {
    const expiresIn = options.expiresAfterSeconds;
    if (
      expiresIn != null &&
      (!Number.isInteger(expiresIn) || expiresIn <= 0 || expiresIn > 3600)
    ) {
      throw new Error(
        'Cartesia realtime client secrets must expire between 1 and 3600 seconds.',
      );
    }

    const sessionConfig = options.sessionConfig;
    const language = sessionConfig?.inputAudioTranscription?.language;
    if (language != null && language !== 'en') {
      throw new Error('Cartesia Ink 2 currently supports English only.');
    }

    const fetchFn = this.config.fetch ?? fetch;
    const response = await fetchFn(`${this.config.baseURL}/access-token`, {
      method: 'POST',
      headers: {
        ...this.config.headers(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grants: { stt: true },
        ...(expiresIn != null ? { expires_in: expiresIn } : {}),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Cartesia realtime client secret request failed: ${response.status} ${text}`,
      );
    }

    const data = (await response.json()) as { token?: unknown };
    if (typeof data.token !== 'string' || data.token.length === 0) {
      throw new Error(
        'Cartesia realtime client secret response did not include a token.',
      );
    }

    const turnDetection = sessionConfig?.turnDetection;
    const useTurnDetection =
      turnDetection === undefined ||
      (turnDetection !== null && turnDetection.type !== 'disabled');
    const inputAudioFormat = sessionConfig?.inputAudioFormat;
    const url = new URL(
      useTurnDetection
        ? `${this.config.baseURL}/stt/turns/websocket`
        : `${this.config.baseURL}/stt/websocket`,
    );
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    url.searchParams.set('model', this.modelId);
    url.searchParams.set(
      'encoding',
      resolveCartesiaEncoding(inputAudioFormat?.type),
    );
    url.searchParams.set(
      'sample_rate',
      String(inputAudioFormat?.rate ?? 24000),
    );
    url.searchParams.set('cartesia_version', this.config.version);
    if (!useTurnDetection && language != null) {
      url.searchParams.set('language', language);
    }

    return {
      token: data.token,
      url: url.toString(),
      ...(expiresIn != null
        ? {
            expiresAt:
              Math.floor(
                (
                  this.config._internal?.currentDate?.() ?? new Date()
                ).getTime() / 1000,
              ) + expiresIn,
          }
        : {}),
    };
  }

  getWebSocketConfig(options: { token: string; url: string }): {
    url: string;
  } {
    const url = new URL(options.url);
    this.useTurnDetection = url.pathname.includes('/stt/turns/websocket');
    url.searchParams.set('access_token', options.token);
    return { url: url.toString() };
  }

  parseServerEvent(
    raw: unknown,
  ): RealtimeModelV4ServerEvent | RealtimeModelV4ServerEvent[] {
    const event = raw as CartesiaRealtimeWireEvent;
    const requestId = event.request_id ?? 'cartesia-realtime';
    let mapped: RealtimeModelV4ServerEvent | RealtimeModelV4ServerEvent[];

    switch (event.type) {
      case 'connected':
        this.sessionCreated = true;
        return {
          type: 'session-created',
          sessionId: event.request_id,
          raw,
        };

      case 'turn.start':
        mapped = { type: 'speech-started', itemId: requestId, raw };
        break;

      case 'turn.resume':
        mapped = [
          { type: 'speech-started', itemId: requestId, raw },
          { type: 'custom', rawType: event.type, raw },
        ];
        break;

      case 'turn.end':
        mapped = [
          { type: 'speech-stopped', itemId: requestId, raw },
          {
            type: 'input-transcription-completed',
            itemId: requestId,
            transcript: event.transcript ?? '',
            raw,
          },
        ];
        break;

      case 'transcript':
        if (event.is_final === true) {
          this.manualTranscript.text += event.text ?? '';
          this.manualTranscript.duration += event.duration ?? 0;
          this.manualTranscript.events.push(event);
        }
        mapped = { type: 'custom', rawType: event.type, raw };
        break;

      case 'flush_done':
        mapped = this.finishManualTranscript(event, raw);
        break;

      case 'done': {
        if (this.manualTranscript.text.length > 0) {
          const completed = this.finishManualTranscript(event, raw);
          mapped = Array.isArray(completed)
            ? [...completed, { type: 'custom', rawType: event.type, raw }]
            : [completed, { type: 'custom', rawType: event.type, raw }];
        } else {
          mapped = { type: 'custom', rawType: event.type, raw };
        }
        break;
      }

      case 'error':
        mapped = {
          type: 'error',
          message: event.message ?? 'Unknown Cartesia realtime error',
          code: event.error_code,
          raw,
        };
        break;

      default:
        mapped = { type: 'custom', rawType: event.type, raw };
        break;
    }

    return this.withSessionCreated(mapped, requestId, raw);
  }

  serializeClientEvent(event: RealtimeModelV4ClientEvent): unknown {
    switch (event.type) {
      case 'session-update':
      case 'input-audio-clear':
      case 'response-create':
        return null;
      case 'input-audio-append':
        return convertBase64ToUint8Array(event.audio);
      case 'input-audio-commit':
        return this.useTurnDetection ? null : 'finalize';
      default:
        throw new Error(
          `Cartesia Ink 2 does not support realtime client event "${event.type}".`,
        );
    }
  }

  buildSessionConfig(_config: RealtimeModelV4SessionConfig): null {
    return null;
  }

  private finishManualTranscript(
    event: CartesiaRealtimeWireEvent,
    raw: unknown,
  ): RealtimeModelV4ServerEvent | RealtimeModelV4ServerEvent[] {
    const state = this.manualTranscript;
    this.manualTranscript = { duration: 0, events: [], text: '' };
    if (state.text.length === 0) {
      return { type: 'custom', rawType: event.type, raw };
    }

    return [
      {
        type: 'audio-committed',
        itemId: event.request_id,
        raw,
      },
      {
        type: 'input-transcription-completed',
        itemId: event.request_id ?? 'cartesia-realtime',
        transcript: state.text,
        raw: {
          event,
          transcriptEvents: state.events,
          duration: state.duration,
        },
      },
    ];
  }

  private withSessionCreated(
    event: RealtimeModelV4ServerEvent | RealtimeModelV4ServerEvent[],
    sessionId: string,
    raw: unknown,
  ): RealtimeModelV4ServerEvent | RealtimeModelV4ServerEvent[] {
    if (this.sessionCreated) {
      return event;
    }
    this.sessionCreated = true;
    const created: RealtimeModelV4ServerEvent = {
      type: 'session-created',
      sessionId,
      raw,
    };
    return Array.isArray(event) ? [created, ...event] : [created, event];
  }
}

function resolveCartesiaEncoding(type: string | undefined): string {
  switch (type) {
    case undefined:
    case 'audio/pcm':
      return 'pcm_s16le';
    case 'audio/pcmu':
      return 'pcm_mulaw';
    case 'audio/pcma':
      return 'pcm_alaw';
    default:
      throw new Error(`Unsupported Cartesia realtime audio format: ${type}`);
  }
}
