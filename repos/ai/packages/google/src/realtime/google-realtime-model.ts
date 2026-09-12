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
  GoogleRealtimeEventMapper,
  buildGoogleSessionConfig,
} from './google-realtime-event-mapper';

const realtimeWebSocketPath =
  'google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

function getRealtimeBaseURL(baseURL: string): URL {
  const url = new URL(baseURL);
  const pathSegments = url.pathname.split('/');
  const version = pathSegments.at(-1);

  if (version === 'v1beta' || version === 'v1alpha') {
    pathSegments.pop();
    url.pathname = pathSegments.join('/') || '/';
  }

  return url;
}

function getAuthTokensURL(baseURL: string): string {
  const url = getRealtimeBaseURL(baseURL);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1alpha/auth_tokens`;
  return url.toString();
}

function getWebSocketURL(baseURL: string): string {
  const url = getRealtimeBaseURL(baseURL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws/${realtimeWebSocketPath}`;
  return url.toString();
}

export type GoogleRealtimeModelConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class GoogleRealtimeModel implements RealtimeModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider: string;
  readonly modelId: string;

  private readonly config: GoogleRealtimeModelConfig;
  private readonly mapper = new GoogleRealtimeEventMapper();

  constructor(modelId: string, config: GoogleRealtimeModelConfig) {
    this.modelId = modelId;
    this.provider = config.provider;
    this.config = config;
  }

  async doCreateClientSecret(
    options: RealtimeModelV4ClientSecretOptions,
  ): Promise<RealtimeModelV4ClientSecretResult> {
    const fetchFn = this.config.fetch ?? fetch;
    const headers = this.config.headers();
    const apiKey = headers['x-goog-api-key'];

    if (!apiKey) {
      throw new Error(
        'Google Generative AI API key is required for realtime token creation.',
      );
    }

    // `newSessionExpireTime` controls how long the token can be used to *open*
    // a session — the window callers actually care about — so map
    // `expiresAfterSeconds` to it (Google otherwise defaults it to ~60s).
    // `expireTime` is the overall token lifetime and must be >=
    // `newSessionExpireTime`, so extend it to leave room for the opened session
    // to run.
    const now = Date.now();
    const openWindowMs = (options.expiresAfterSeconds ?? 60) * 1000;
    const newSessionExpireTime = new Date(now + openWindowMs).toISOString();
    const expireTime = new Date(
      now + openWindowMs + 30 * 60 * 1000,
    ).toISOString();

    const setupPayload = buildGoogleSessionConfig(
      options.sessionConfig,
      this.modelId,
    );

    const response = await fetchFn(
      `${getAuthTokensURL(this.config.baseURL)}?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // `uses: 0` means no limit is applied to how many times the token can
          // start a session (per the AuthToken spec). An unset value would
          // default to 1, which breaks WebSocket reconnects within the session.
          uses: 0,
          expireTime,
          newSessionExpireTime,
          bidiGenerateContentSetup: setupPayload,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Google realtime auth token request failed: ${response.status} ${text}`,
      );
    }

    const data = (await response.json()) as {
      name: string;
      expireTime?: string;
    };

    return {
      token: data.name,
      url: getWebSocketURL(this.config.baseURL),
      expiresAt: data.expireTime
        ? Math.floor(new Date(data.expireTime).getTime() / 1000)
        : undefined,
    };
  }

  getWebSocketConfig(options: { token: string; url: string }): {
    url: string;
    protocols?: string[];
  } {
    return {
      url: `${options.url}?access_token=${encodeURIComponent(options.token)}`,
    };
  }

  parseServerEvent(
    raw: unknown,
  ): RealtimeModelV4ServerEvent | RealtimeModelV4ServerEvent[] {
    return this.mapper.parseServerEvent(raw);
  }

  serializeClientEvent(
    event: RealtimeModelV4ClientEvent,
  ): ReturnType<RealtimeModelV4['serializeClientEvent']> {
    return this.mapper.serializeClientEvent(event, this.modelId);
  }

  buildSessionConfig(
    config: RealtimeModelV4SessionConfig,
  ): Record<string, unknown> {
    return buildGoogleSessionConfig(config, this.modelId);
  }
}
