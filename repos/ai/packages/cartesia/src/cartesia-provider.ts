import {
  type Experimental_RealtimeFactoryV4 as RealtimeFactoryV4,
  type Experimental_RealtimeFactoryV4GetTokenOptions as RealtimeFactoryV4GetTokenOptions,
  NoSuchModelError,
  type TranscriptionModelV4,
  type SpeechModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withUserAgentSuffix,
  type FetchFunction,
  type WebSocketConstructor,
} from '@ai-sdk/provider-utils';
import { CartesiaTranscriptionModel } from './cartesia-transcription-model';
import type { CartesiaTranscriptionModelId } from './cartesia-transcription-options';
import { CartesiaSpeechModel } from './cartesia-speech-model';
import type { CartesiaSpeechModelId } from './cartesia-speech-options';
import { CartesiaRealtimeModel } from './cartesia-realtime-model';
import type { CartesiaRealtimeModelId } from './cartesia-realtime-model-options';
import { VERSION } from './version';

/**
 * The Cartesia API version sent with every request via the `Cartesia-Version`
 * header. See https://docs.cartesia.ai/api-reference/api-versioning
 */
const CARTESIA_API_VERSION = '2026-03-01';

export interface CartesiaProvider extends ProviderV4 {
  (
    modelId: CartesiaSpeechModelId,
    settings?: {},
  ): {
    speech: CartesiaSpeechModel;
  };

  /**
   * Creates a model for transcription.
   */
  transcription(modelId: CartesiaTranscriptionModelId): TranscriptionModelV4;

  /**
   * Creates a model for speech generation.
   */
  speech(modelId: CartesiaSpeechModelId): SpeechModelV4;

  /**
   * Creates a realtime Ink speech-to-text model.
   */
  experimental_realtime: RealtimeFactoryV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export interface CartesiaProviderSettings {
  /**
   * API key for authenticating requests.
   */
  apiKey?: string;

  /**
   * The Cartesia API version to use (sent via the `Cartesia-Version` header).
   */
  version?: string;

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
   * Custom WebSocket implementation for streaming transcription.
   */
  webSocket?: WebSocketConstructor;
}

/**
 * Create a Cartesia provider instance.
 */
export function createCartesia(
  options: CartesiaProviderSettings = {},
): CartesiaProvider {
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'CARTESIA_API_KEY',
          description: 'Cartesia',
        })}`,
        'Cartesia-Version': options.version ?? CARTESIA_API_VERSION,
        ...options.headers,
      },
      `ai-sdk/cartesia/${VERSION}`,
    );

  const createTranscriptionModel = (modelId: CartesiaTranscriptionModelId) =>
    new CartesiaTranscriptionModel(modelId, {
      provider: `cartesia.transcription`,
      url: ({ path }) => `https://api.cartesia.ai${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      version: options.version ?? CARTESIA_API_VERSION,
      webSocket: options.webSocket,
    });

  const createSpeechModel = (modelId: CartesiaSpeechModelId) =>
    new CartesiaSpeechModel(modelId, {
      provider: `cartesia.speech`,
      url: ({ path }) => `https://api.cartesia.ai${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createRealtimeModel = (modelId: CartesiaRealtimeModelId) =>
    new CartesiaRealtimeModel(modelId, {
      provider: `cartesia.realtime`,
      baseURL: 'https://api.cartesia.ai',
      version: options.version ?? CARTESIA_API_VERSION,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const experimentalRealtimeFactory = Object.assign(
    (modelId: CartesiaRealtimeModelId) => createRealtimeModel(modelId),
    {
      getToken: async (tokenOptions: RealtimeFactoryV4GetTokenOptions) => {
        const secret = await createRealtimeModel(
          tokenOptions.model as CartesiaRealtimeModelId,
        ).doCreateClientSecret({
          sessionConfig: tokenOptions.sessionConfig,
          expiresAfterSeconds: tokenOptions.expiresAfterSeconds,
        });

        return {
          token: secret.token,
          url: secret.url,
          expiresAt: secret.expiresAt,
        };
      },
    },
  ) as RealtimeFactoryV4;

  const provider = function (modelId: CartesiaSpeechModelId) {
    return {
      speech: createSpeechModel(modelId),
    };
  };

  provider.specificationVersion = 'v4' as const;
  provider.transcription = createTranscriptionModel;
  provider.transcriptionModel = createTranscriptionModel;
  provider.speech = createSpeechModel;
  provider.speechModel = createSpeechModel;
  provider.experimental_realtime = experimentalRealtimeFactory;

  // Required ProviderV4 methods that are not supported
  provider.languageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'languageModel',
      message: 'Cartesia does not provide language models',
    });
  };

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
      message: 'Cartesia does not provide embedding models',
    });
  };
  provider.textEmbeddingModel = provider.embeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message: 'Cartesia does not provide image models',
    });
  };

  return provider as CartesiaProvider;
}

/**
 * Default Cartesia provider instance.
 */
export const cartesia = createCartesia();
