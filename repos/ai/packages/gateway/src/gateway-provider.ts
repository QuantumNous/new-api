import {
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  loadOptionalSetting,
  postJsonToApi,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
  type WebSocketConstructor,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { asGatewayError, GatewayAuthenticationError } from './errors';
import {
  GATEWAY_AUTH_METHOD_HEADER,
  VERCEL_AI_GATEWAY_TEAM_HEADER,
} from './gateway-headers';
import { parseAuthMethod } from './errors/parse-auth-method';
import {
  GatewayFetchMetadata,
  type GatewayFetchMetadataResponse,
  type GatewayCreditsResponse,
} from './gateway-fetch-metadata';
import {
  GatewaySpendReport,
  type GatewaySpendReportParams,
  type GatewaySpendReportResponse,
} from './gateway-spend-report';
import {
  GatewayGenerationInfoFetcher,
  type GatewayGenerationInfoParams,
  type GatewayGenerationInfo,
} from './gateway-generation-info';
import { GatewayLanguageModel } from './gateway-language-model';
import { GatewayEmbeddingModel } from './gateway-embedding-model';
import { GatewayImageModel } from './gateway-image-model';
import { GatewayVideoModel } from './gateway-video-model';
import { GatewayRerankingModel } from './gateway-reranking-model';
import { GatewaySpeechModel } from './gateway-speech-model';
import {
  GatewayTranscriptionModel,
  toGatewayTranscriptionUrl,
} from './gateway-transcription-model';
import { GatewayRealtimeModel } from './gateway-realtime-model';
import type { GatewayEmbeddingModelId } from './gateway-embedding-model-settings';
import type { GatewayImageModelId } from './gateway-image-model-settings';
import type { GatewayRerankingModelId } from './gateway-reranking-model-settings';
import type { GatewaySpeechModelId } from './gateway-speech-model-settings';
import type { GatewayTranscriptionModelId } from './gateway-transcription-model-settings';
import type { GatewayRealtimeModelId } from './gateway-realtime-model-settings';
import type { GatewayVideoModelId } from './gateway-video-model-settings';
import { gatewayTools } from './gateway-tools';
import { getVercelOidcToken, getVercelRequestId } from './vercel-environment';
import type { GatewayModelId } from './gateway-language-model-settings';
import type {
  LanguageModelV4,
  EmbeddingModelV4,
  ImageModelV4,
  RerankingModelV4,
  SpeechModelV4,
  TranscriptionModelV4,
  Experimental_VideoModelV4,
  Experimental_RealtimeFactoryV4 as RealtimeFactoryV4,
  Experimental_RealtimeFactoryV4GetTokenOptions as RealtimeFactoryV4GetTokenOptions,
  ProviderV4,
} from '@ai-sdk/provider';
import { VERSION } from './version';

export interface GatewayProvider extends ProviderV4 {
  (modelId: GatewayModelId): LanguageModelV4;

  /**
   * Creates a model for text generation.
   */
  chat(modelId: GatewayModelId): LanguageModelV4;

  /**
   * Creates a model for text generation.
   */
  languageModel(modelId: GatewayModelId): LanguageModelV4;

  /**
   * Returns available providers and models for use with the remote provider.
   */
  getAvailableModels(): Promise<GatewayFetchMetadataResponse>;

  /**
   * Returns credit information for the authenticated user.
   */
  getCredits(): Promise<GatewayCreditsResponse>;

  /**
   * Returns a spend report with cost, token, and request count data,
   * aggregated by the specified dimension.
   */
  getSpendReport(
    params: GatewaySpendReportParams,
  ): Promise<GatewaySpendReportResponse>;

  /**
   * Returns detailed information about a specific generation by its ID,
   * including cost, token usage, latency, and provider details.
   */
  getGenerationInfo(
    params: GatewayGenerationInfoParams,
  ): Promise<GatewayGenerationInfo>;

  /**
   * Creates a model for generating text embeddings.
   */
  embedding(modelId: GatewayEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for generating text embeddings.
   */
  embeddingModel(modelId: GatewayEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: GatewayEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for generating images.
   */
  image(modelId: GatewayImageModelId): ImageModelV4;

  /**
   * Creates a model for generating images.
   */
  imageModel(modelId: GatewayImageModelId): ImageModelV4;

  /**
   * Creates a model for generating videos.
   */
  video(modelId: GatewayVideoModelId): Experimental_VideoModelV4;

  /**
   * Creates a model for generating videos.
   */
  videoModel(modelId: GatewayVideoModelId): Experimental_VideoModelV4;

  /**
   * Creates a model for reranking documents.
   */
  reranking(modelId: GatewayRerankingModelId): RerankingModelV4;

  /**
   * Creates a model for reranking documents.
   */
  rerankingModel(modelId: GatewayRerankingModelId): RerankingModelV4;

  /**
   * Creates a model for text-to-speech generation.
   */
  speech(modelId: GatewaySpeechModelId): SpeechModelV4;

  /**
   * Creates a model for text-to-speech generation.
   */
  speechModel(modelId: GatewaySpeechModelId): SpeechModelV4;

  /**
   * Creates a model for audio transcription.
   */
  transcription(modelId: GatewayTranscriptionModelId): TranscriptionModelV4;

  /**
   * Creates a model for audio transcription.
   */
  transcriptionModel(
    modelId: GatewayTranscriptionModelId,
  ): TranscriptionModelV4;

  /**
   * Creates an experimental realtime model for bidirectional audio/text
   * communication over WebSocket, normalized through the AI Gateway.
   */
  experimental_realtime: RealtimeFactoryV4;

  /**
   * Experimental streaming-transcription entry point. Callable like
   * `transcription(modelId)`, plus `getToken` for minting a short-lived
   * client secret (`vcst_`) a browser can use to open the streaming
   * transcription WebSocket without holding the Gateway credential.
   */
  experimental_transcription: GatewayTranscriptionFactory;

  /**
   * Gateway-specific tools executed server-side.
   */
  tools: typeof gatewayTools;
}

export type GatewayTranscriptionFactoryGetTokenOptions = {
  model: GatewayTranscriptionModelId;
  /** Token lifetime in seconds. Gateway default is 60s (max 300s). */
  expiresAfterSeconds?: number;
};

export type GatewayTranscriptionFactoryGetTokenResult = {
  /** The minted `vcst_` client secret. */
  token: string;
  /** WebSocket URL of the streaming transcription surface for this model. */
  url: string;
  /** Token expiry, epoch seconds. */
  expiresAt?: number;
};

/**
 * Streaming-transcription factory: callable like `transcription(modelId)`,
 * plus a server-side `getToken` that mints a transcription-bound short-lived
 * client secret (`vcst_`). The browser connects with
 * `createGateway({ apiKey: token }).transcription(modelId)` — the token rides
 * the same auth subprotocol an API key does, without exposing the credential.
 */
export interface GatewayTranscriptionFactory {
  (modelId: GatewayTranscriptionModelId): TranscriptionModelV4;

  getToken(
    options: GatewayTranscriptionFactoryGetTokenOptions,
  ): Promise<GatewayTranscriptionFactoryGetTokenResult>;
}

export interface GatewayProviderSettings {
  /**
   * The base URL prefix for API calls. Defaults to `https://ai-gateway.vercel.sh/v4/ai`.
   */
  baseURL?: string;

  /**
   * API key or Vercel access token that is being sent using the `Authorization`
   * header. It defaults to the `AI_GATEWAY_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Vercel team ID or slug to scope requests for access tokens that can access
   * multiple teams.
   */
  teamIdOrSlug?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;

  /**
   * Custom WebSocket implementation used for streaming transcription. This is
   * useful for testing or for runtimes without a global WebSocket. A
   * header-capable implementation is not required — Gateway WebSocket auth is
   * carried in the subprotocols.
   */
  webSocket?: WebSocketConstructor;

  /**
   * How frequently to refresh the metadata cache in milliseconds.
   */
  metadataCacheRefreshMillis?: number;

  /**
   * @internal For testing purposes only
   */
  _internal?: {
    currentDate?: () => Date;
  };
}

const AI_GATEWAY_PROTOCOL_VERSION = '0.0.1';

/** Response shape of `POST /v1/realtime/client-secrets`. `expiresAt` is epoch seconds. */
const gatewayClientSecretResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.number().nullish(),
});

/**
 * Create a remote provider instance.
 */
export function createGateway(
  options: GatewayProviderSettings = {},
): GatewayProvider {
  let pendingMetadata: Promise<GatewayFetchMetadataResponse> | null = null;
  let metadataCache: GatewayFetchMetadataResponse | null = null;
  const cacheRefreshMillis =
    options.metadataCacheRefreshMillis ?? 1000 * 60 * 5;
  let lastFetchTime = 0;

  const baseURL =
    withoutTrailingSlash(options.baseURL) ??
    'https://ai-gateway.vercel.sh/v4/ai';

  const createAuthHeaders = (auth: {
    token: string;
    authMethod: 'api-key' | 'oidc';
  }) =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${auth.token}`,
        'ai-gateway-protocol-version': AI_GATEWAY_PROTOCOL_VERSION,
        [GATEWAY_AUTH_METHOD_HEADER]: auth.authMethod,
        ...(options.teamIdOrSlug != null
          ? { [VERCEL_AI_GATEWAY_TEAM_HEADER]: options.teamIdOrSlug }
          : {}),
        ...options.headers,
      },
      `ai-sdk/gateway/${VERSION}`,
    );

  const getHeaders = async () => {
    try {
      return createAuthHeaders(await getGatewayAuthToken(options));
    } catch (error) {
      throw GatewayAuthenticationError.createContextualError({
        apiKeyProvided: false,
        oidcTokenProvided: false,
        statusCode: 401,
        cause: error,
      });
    }
  };

  const getRealtimeAuthToken = async () => {
    try {
      return await getGatewayAuthToken(options);
    } catch (error) {
      throw GatewayAuthenticationError.createContextualError({
        apiKeyProvided: false,
        oidcTokenProvided: false,
        statusCode: 401,
        cause: error,
      });
    }
  };

  // Mints a short-lived client secret (`vcst_`) via the Gateway's
  // `/v1/realtime/client-secrets` route, authenticated with the long-lived
  // Gateway credential. Server-side only (asserted) — the credential never
  // belongs in a browser; the browser receives only the minted token. The
  // mint route lives at the gateway origin's `/v1/realtime/client-secrets`,
  // not under the `baseURL` path (which targets `/v4/ai`), so the URL is
  // resolved against the origin. `routeKind` binds the token to a WebSocket
  // surface; it is omitted for realtime (the gateway default) so older
  // gateway deployments keep accepting realtime mints.
  const mintClientSecret = async (params: {
    modelId: string;
    expiresAfterSeconds?: number;
    routeKind?: 'transcription';
  }): Promise<{ token: string; expiresAt?: number }> => {
    assertGatewayClientSecretServerEnvironment();
    const auth = await getRealtimeAuthToken();
    const headers = createAuthHeaders(auth);
    const url = new URL('/v1/realtime/client-secrets', baseURL).toString();
    try {
      const { value } = await postJsonToApi({
        url,
        headers,
        body: {
          model: params.modelId,
          ...(params.routeKind != null && { routeKind: params.routeKind }),
          ...(params.expiresAfterSeconds != null && {
            expiresIn: params.expiresAfterSeconds,
          }),
        },
        successfulResponseHandler: createJsonResponseHandler(
          gatewayClientSecretResponseSchema,
        ),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: data => data,
        }),
        fetch: options.fetch,
      });
      return {
        token: value.token,
        ...(value.expiresAt != null && { expiresAt: value.expiresAt }),
      };
    } catch (error) {
      throw await asGatewayError(error, await parseAuthMethod(headers));
    }
  };

  const createO11yHeaders = () => {
    const deploymentId = loadOptionalSetting({
      settingValue: undefined,
      environmentVariableName: 'VERCEL_DEPLOYMENT_ID',
    });
    const environment = loadOptionalSetting({
      settingValue: undefined,
      environmentVariableName: 'VERCEL_ENV',
    });
    const region = loadOptionalSetting({
      settingValue: undefined,
      environmentVariableName: 'VERCEL_REGION',
    });
    const projectId = loadOptionalSetting({
      settingValue: undefined,
      environmentVariableName: 'VERCEL_PROJECT_ID',
    });

    return async () => {
      const requestId = await getVercelRequestId();
      return {
        ...(deploymentId && { 'ai-o11y-deployment-id': deploymentId }),
        ...(environment && { 'ai-o11y-environment': environment }),
        ...(region && { 'ai-o11y-region': region }),
        ...(requestId && { 'ai-o11y-request-id': requestId }),
        ...(projectId && { 'ai-o11y-project-id': projectId }),
      };
    };
  };

  const createLanguageModel = (modelId: GatewayModelId) => {
    return new GatewayLanguageModel(modelId, {
      provider: 'gateway',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders(),
    });
  };

  const getAvailableModels = async () => {
    const now = options._internal?.currentDate?.().getTime() ?? Date.now();
    if (!pendingMetadata || now - lastFetchTime > cacheRefreshMillis) {
      lastFetchTime = now;

      pendingMetadata = new GatewayFetchMetadata({
        baseURL,
        headers: getHeaders,
        fetch: options.fetch,
      })
        .getAvailableModels()
        .then(metadata => {
          metadataCache = metadata;
          return metadata;
        })
        .catch(async (error: unknown) => {
          throw await asGatewayError(
            error,
            await parseAuthMethod(await getHeaders()),
          );
        });
    }

    return metadataCache ? Promise.resolve(metadataCache) : pendingMetadata;
  };

  const getCredits = async () => {
    return new GatewayFetchMetadata({
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    })
      .getCredits()
      .catch(async (error: unknown) => {
        throw await asGatewayError(
          error,
          await parseAuthMethod(await getHeaders()),
        );
      });
  };

  const getSpendReport = async (params: GatewaySpendReportParams) => {
    return new GatewaySpendReport({
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    })
      .getSpendReport(params)
      .catch(async (error: unknown) => {
        throw await asGatewayError(
          error,
          await parseAuthMethod(await getHeaders()),
        );
      });
  };

  const getGenerationInfo = async (params: GatewayGenerationInfoParams) => {
    return new GatewayGenerationInfoFetcher({
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    })
      .getGenerationInfo(params)
      .catch(async (error: unknown) => {
        throw await asGatewayError(
          error,
          await parseAuthMethod(await getHeaders()),
        );
      });
  };

  const provider = function (modelId: GatewayModelId) {
    if (new.target) {
      throw new Error(
        'The Gateway Provider model function cannot be called with the new keyword.',
      );
    }

    return createLanguageModel(modelId);
  };

  provider.specificationVersion = 'v4' as const;
  provider.getAvailableModels = getAvailableModels;
  provider.getCredits = getCredits;
  provider.getSpendReport = getSpendReport;
  provider.getGenerationInfo = getGenerationInfo;
  provider.imageModel = (modelId: GatewayImageModelId) => {
    return new GatewayImageModel(modelId, {
      provider: 'gateway',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders(),
    });
  };
  provider.languageModel = createLanguageModel;
  const createEmbeddingModel = (modelId: GatewayEmbeddingModelId) => {
    return new GatewayEmbeddingModel(modelId, {
      provider: 'gateway',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders(),
    });
  };
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.videoModel = (modelId: GatewayVideoModelId) => {
    return new GatewayVideoModel(modelId, {
      provider: 'gateway',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders(),
    });
  };
  const createRerankingModel = (modelId: GatewayRerankingModelId) => {
    return new GatewayRerankingModel(modelId, {
      provider: 'gateway',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders(),
    });
  };
  provider.rerankingModel = createRerankingModel;
  provider.reranking = createRerankingModel;
  const createSpeechModel = (modelId: GatewaySpeechModelId) => {
    return new GatewaySpeechModel(modelId, {
      provider: 'gateway',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders(),
    });
  };
  provider.speechModel = createSpeechModel;
  provider.speech = createSpeechModel;
  const createTranscriptionModel = (modelId: GatewayTranscriptionModelId) => {
    return new GatewayTranscriptionModel(modelId, {
      provider: 'gateway',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      o11yHeaders: createO11yHeaders(),
      webSocket: options.webSocket,
    });
  };
  provider.transcriptionModel = createTranscriptionModel;
  provider.transcription = createTranscriptionModel;
  // Callable like `transcription(modelId)`; `getToken` mints a
  // transcription-bound client secret (server-side only) the browser uses to
  // connect via `createGateway({ apiKey: token }).transcription(modelId)`.
  provider.experimental_transcription = Object.assign(
    (modelId: GatewayTranscriptionModelId) => createTranscriptionModel(modelId),
    {
      getToken: async (
        tokenOptions: GatewayTranscriptionFactoryGetTokenOptions,
      ): Promise<GatewayTranscriptionFactoryGetTokenResult> => {
        const secret = await mintClientSecret({
          modelId: tokenOptions.model,
          routeKind: 'transcription',
          ...(tokenOptions.expiresAfterSeconds != null && {
            expiresAfterSeconds: tokenOptions.expiresAfterSeconds,
          }),
        });
        return {
          token: secret.token,
          url: toGatewayTranscriptionUrl(baseURL, tokenOptions.model),
          ...(secret.expiresAt != null && { expiresAt: secret.expiresAt }),
        };
      },
    },
  ) as GatewayTranscriptionFactory;

  // No server-environment guard here: building the realtime model is just the
  // event codec + WebSocket-config helper, which the browser legitimately
  // needs to drive the transport with a server-minted client secret. The
  // server-only boundary is enforced on minting itself (`mintClientSecret`),
  // which requires the Gateway credential.
  const createRealtimeModel = (modelId: GatewayRealtimeModelId) =>
    new GatewayRealtimeModel(modelId, {
      provider: 'gateway.realtime',
      baseURL,
      teamIdOrSlug: options.teamIdOrSlug,
      createClientSecret: mintClientSecret,
    });
  provider.experimental_realtime = Object.assign(
    (modelId: GatewayRealtimeModelId) => createRealtimeModel(modelId),
    {
      getToken: async (tokenOptions: RealtimeFactoryV4GetTokenOptions) => {
        const { model: modelId, ...secretOptions } = tokenOptions;
        const model = createRealtimeModel(modelId);
        const secret = await model.doCreateClientSecret(secretOptions);
        return {
          token: secret.token,
          url: secret.url,
          ...(secret.expiresAt != null && { expiresAt: secret.expiresAt }),
        };
      },
    },
  ) as RealtimeFactoryV4;

  provider.chat = provider.languageModel;
  provider.embedding = provider.embeddingModel;
  provider.image = provider.imageModel;
  provider.video = provider.videoModel;
  provider.tools = gatewayTools;
  return provider;
}

export const gateway = createGateway();

export async function getGatewayAuthToken(
  options: GatewayProviderSettings,
): Promise<{ token: string; authMethod: 'api-key' | 'oidc' }> {
  const apiKey = loadOptionalSetting({
    settingValue: options.apiKey,
    environmentVariableName: 'AI_GATEWAY_API_KEY',
  });

  if (apiKey) {
    return {
      token: apiKey,
      authMethod: 'api-key',
    };
  }

  const oidcToken = await getVercelOidcToken();
  return {
    token: oidcToken,
    authMethod: 'oidc',
  };
}

function assertGatewayClientSecretServerEnvironment(): void {
  if (typeof globalThis.window !== 'undefined') {
    throw new Error(
      'AI Gateway client secrets must be minted server-side: minting needs your Gateway credential, which must never reach the browser. Call gateway.experimental_realtime.getToken() or gateway.experimental_transcription.getToken() from your server and pass the returned token to the client.',
    );
  }
}
