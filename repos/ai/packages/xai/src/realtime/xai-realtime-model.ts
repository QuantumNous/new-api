import type {
  Experimental_RealtimeModelV4 as RealtimeModelV4,
  Experimental_RealtimeModelV4ClientEvent as RealtimeModelV4ClientEvent,
  Experimental_RealtimeModelV4ClientSecretOptions as RealtimeModelV4ClientSecretOptions,
  Experimental_RealtimeModelV4ClientSecretResult as RealtimeModelV4ClientSecretResult,
  Experimental_RealtimeModelV4ServerEvent as RealtimeModelV4ServerEvent,
  Experimental_RealtimeModelV4SessionConfig as RealtimeModelV4SessionConfig,
} from '@ai-sdk/provider';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import {
  buildXaiSessionConfig,
  parseXaiRealtimeServerEvent,
  serializeXaiRealtimeClientEvent,
} from './xai-realtime-event-mapper';

export type XaiRealtimeModelConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class XaiRealtimeModel implements RealtimeModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider: string;
  readonly modelId: string;

  private readonly config: XaiRealtimeModelConfig;

  constructor(modelId: string, config: XaiRealtimeModelConfig) {
    this.modelId = modelId;
    this.provider = config.provider;
    this.config = config;
  }

  async doCreateClientSecret(
    options: RealtimeModelV4ClientSecretOptions,
  ): Promise<RealtimeModelV4ClientSecretResult> {
    const fetchFn = this.config.fetch ?? fetch;
    const url = `${this.config.baseURL}/realtime/client_secrets`;

    const body: Record<string, unknown> = {};
    if (options.expiresAfterSeconds != null) {
      body.expires_after = { seconds: options.expiresAfterSeconds };
    }

    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        ...this.config.headers(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `xAI realtime client secret request failed: ${response.status} ${text}`,
      );
    }

    const data = (await response.json()) as {
      value: string;
      expires_at?: number;
    };

    return {
      token: data.value,
      // xAI selects the voice model from the `model` query parameter on the
      // WebSocket URL. Without it the model choice is silently ignored and the
      // server falls back to its default voice model.
      url: `wss://${new URL(this.config.baseURL).host}/v1/realtime?model=${encodeURIComponent(this.modelId)}`,
      expiresAt: data.expires_at,
    };
  }

  getWebSocketConfig(options: { token: string; url: string }): {
    url: string;
    protocols?: string[];
  } {
    return {
      url: options.url,
      protocols: [`xai-client-secret.${options.token}`],
    };
  }

  parseServerEvent(raw: unknown): RealtimeModelV4ServerEvent {
    return parseXaiRealtimeServerEvent(raw);
  }

  serializeClientEvent(event: RealtimeModelV4ClientEvent): unknown {
    return serializeXaiRealtimeClientEvent(event);
  }

  buildSessionConfig(
    config: RealtimeModelV4SessionConfig,
  ): Record<string, unknown> {
    return buildXaiSessionConfig(config);
  }
}
