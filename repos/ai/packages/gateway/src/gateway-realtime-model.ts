import type {
  Experimental_RealtimeModelV4 as RealtimeModelV4,
  Experimental_RealtimeModelV4ClientEvent as RealtimeModelV4ClientEvent,
  Experimental_RealtimeModelV4ClientSecretOptions as RealtimeModelV4ClientSecretOptions,
  Experimental_RealtimeModelV4ClientSecretResult as RealtimeModelV4ClientSecretResult,
  Experimental_RealtimeModelV4ServerEvent as RealtimeModelV4ServerEvent,
  Experimental_RealtimeModelV4SessionConfig as RealtimeModelV4SessionConfig,
} from '@ai-sdk/provider';
import { getGatewayRealtimeProtocols } from './gateway-realtime-auth';

export type GatewayRealtimeModelConfig = {
  provider: string;
  baseURL: string;
  teamIdOrSlug?: string;
  /**
   * Mints a short-lived client secret (`vcst_`) for this model via the
   * Gateway's `/v1/realtime/client-secrets` endpoint. Implemented by the
   * provider because minting requires the long-lived Gateway credential
   * (API key / OIDC) and must run server-side.
   */
  createClientSecret: (params: {
    modelId: string;
    expiresAfterSeconds?: number;
  }) => PromiseLike<{ token: string; expiresAt?: number }>;
};

/**
 * Realtime model backed by the AI Gateway.
 *
 * The Gateway normalizes realtime exactly like it normalizes every other
 * modality: the client speaks the normalized AI SDK realtime protocol and the
 * Gateway translates to and from the upstream provider server-side. This model
 * is therefore a thin identity codec over that normalized protocol — only the
 * connection and authentication are Gateway-specific.
 */
export class GatewayRealtimeModel implements RealtimeModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider: string;
  readonly modelId: string;

  private readonly config: GatewayRealtimeModelConfig;

  constructor(modelId: string, config: GatewayRealtimeModelConfig) {
    this.modelId = modelId;
    this.provider = config.provider;
    this.config = config;
  }

  /**
   * Mints a single-use, short-lived client secret (`vcst_`) the browser uses to
   * open the realtime WebSocket without ever holding the long-lived Gateway
   * credential. The customer's server calls this (via
   * `gateway.experimental_realtime.getToken`) and hands the returned token to
   * the browser, which connects with it through the `ai-gateway-auth.<token>`
   * subprotocol. `expiresAfterSeconds` is forwarded to the mint endpoint;
   * `sessionConfig` is intentionally unused here — it is applied later via the
   * normalized `session-update` event.
   */
  async doCreateClientSecret(
    options?: RealtimeModelV4ClientSecretOptions,
  ): Promise<RealtimeModelV4ClientSecretResult> {
    const secret = await this.config.createClientSecret({
      modelId: this.modelId,
      ...(options?.expiresAfterSeconds != null && {
        expiresAfterSeconds: options.expiresAfterSeconds,
      }),
    });
    return {
      token: secret.token,
      url: toGatewayRealtimeUrl(this.config.baseURL, this.modelId),
      ...(secret.expiresAt != null && { expiresAt: secret.expiresAt }),
    };
  }

  getWebSocketConfig(options: { token: string; url: string }): {
    url: string;
    protocols?: string[];
  } {
    return {
      url: options.url,
      protocols: getGatewayRealtimeProtocols(options.token, {
        teamIdOrSlug: this.config.teamIdOrSlug,
      }),
    };
  }

  parseServerEvent(raw: unknown): RealtimeModelV4ServerEvent {
    // The Gateway emits normalized AI SDK realtime events, so no
    // provider-specific mapping is needed on the client.
    return raw as RealtimeModelV4ServerEvent;
  }

  serializeClientEvent(event: RealtimeModelV4ClientEvent): unknown {
    // The Gateway accepts normalized AI SDK realtime events directly.
    return event;
  }

  buildSessionConfig(config: RealtimeModelV4SessionConfig): unknown {
    // The session config is already normalized; the Gateway maps it to the
    // upstream provider's session payload server-side.
    return config;
  }
}

/**
 * Build the Gateway realtime WebSocket URL. The HTTP(S) base URL is upgraded to
 * WS(S) and the model id rides the `?ai-model-id=` query — the WS transport of
 * the `ai-model-id` header the HTTP routes use, since a browser `WebSocket`
 * cannot set headers. The model id is passed through verbatim; the Gateway owns
 * resolution (including the bare → `openai/` qualification), exactly like the
 * non-realtime routes. The query is slash-safe for qualified ids such as
 * `openai/gpt-realtime-2`.
 */
function toGatewayRealtimeUrl(baseURL: string, modelId: string): string {
  const url = new URL(`${baseURL.replace(/^http/, 'ws')}/realtime-model`);
  url.searchParams.set('ai-model-id', modelId);
  return url.toString();
}
