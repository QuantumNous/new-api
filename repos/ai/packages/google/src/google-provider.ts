import type {
  EmbeddingModelV4,
  Experimental_VideoModelV4,
  FilesV4,
  ImageModelV4,
  LanguageModelV4,
  ProviderV4,
  Experimental_RealtimeFactoryV4 as RealtimeFactoryV4,
  Experimental_RealtimeFactoryV4GetTokenOptions as RealtimeFactoryV4GetTokenOptions,
  SpeechModelV4,
} from '@ai-sdk/provider';
import {
  generateId,
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { VERSION } from './version';
import { GoogleEmbeddingModel } from './google-embedding-model';
import type { GoogleEmbeddingModelId } from './google-embedding-model-options';
import { GoogleLanguageModel } from './google-language-model';
import type { GoogleModelId } from './google-language-model-options';
import { googleTools } from './google-tools';

import type {
  GoogleImageSettings,
  GoogleImageModelId,
} from './google-image-settings';
import { GoogleImageModel } from './google-image-model';
import { GoogleFiles } from './google-files';
import { GoogleVideoModel } from './google-video-model';
import type { GoogleVideoModelId } from './google-video-settings';
import { GoogleSpeechModel } from './google-speech-model';
import type { GoogleSpeechModelId } from './google-speech-model-options';
import {
  GoogleInteractionsLanguageModel,
  type GoogleInteractionsModelInput,
} from './interactions/google-interactions-language-model';
import type { GoogleInteractionsModelId } from './interactions/google-interactions-language-model-options';
import type { GoogleInteractionsAgentName } from './interactions/google-interactions-agent';
import { GoogleRealtimeModel } from './realtime/google-realtime-model';

export interface GoogleProvider extends ProviderV4 {
  (modelId: GoogleModelId): LanguageModelV4;

  languageModel(modelId: GoogleModelId): LanguageModelV4;

  chat(modelId: GoogleModelId): LanguageModelV4;

  /**
   * Creates a model for image generation.
   */
  image(
    modelId: GoogleImageModelId,
    settings?: GoogleImageSettings,
  ): ImageModelV4;

  /**
   * @deprecated Use `chat()` instead.
   */
  generativeAI(modelId: GoogleModelId): LanguageModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embedding(modelId: GoogleEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embeddingModel(modelId: GoogleEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embedding` instead.
   */
  textEmbedding(modelId: GoogleEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: GoogleEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for video generation.
   */
  video(modelId: GoogleVideoModelId): Experimental_VideoModelV4;

  /**
   * Creates a model for video generation.
   */
  videoModel(modelId: GoogleVideoModelId): Experimental_VideoModelV4;

  /**
   * Creates a model for speech generation (text-to-speech).
   */
  speech(modelId: GoogleSpeechModelId): SpeechModelV4;

  /**
   * Creates a model for speech generation (text-to-speech).
   */
  speechModel(modelId: GoogleSpeechModelId): SpeechModelV4;

  files(): FilesV4;

  /**
   * Creates a language model targeting the Gemini Interactions API
   * (`POST /v1beta/interactions`). Pass:
   *   - a model ID (string),
   *   - `{ agent: <name> }` to use a known Gemini agent preset, or
   *   - `{ managedAgent: <name> }` to use a user-defined agent created via
   *     the `/v1beta/agents` endpoint.
   */
  interactions(
    modelIdOrAgent:
      | GoogleInteractionsModelId
      | { agent: GoogleInteractionsAgentName }
      | { managedAgent: string },
  ): LanguageModelV4;

  experimental_realtime: RealtimeFactoryV4;

  tools: typeof googleTools;
}

export interface GoogleProviderSettings {
  /**
   * Use a different URL prefix for API calls, e.g. to use proxy servers.
   * The default prefix is `https://generativelanguage.googleapis.com/v1beta`.
   */
  baseURL?: string;

  /**
   * API key that is being send using the `x-goog-api-key` header.
   * It defaults to the `GOOGLE_GENERATIVE_AI_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string | undefined>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;

  /**
   * Optional function to generate a unique ID for each request.
   */
  generateId?: () => string;

  /**
   * Custom provider name
   * Defaults to 'google.generative-ai'.
   */
  name?: string;
}

const supportedExternalUrlMediaTypes = [
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'text/csv',
  'text/rtf',
  'text/javascript',
  'application/json',
  'application/pdf',
  'image/bmp',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/avi',
  'video/x-flv',
  'video/mpg',
  'video/webm',
  'video/wmv',
  'video/3gpp',
];

const externalHttpsUrlPattern = /^https:\/\/.*$/;

function supportsExternalFileUrls(modelId: string) {
  return /(^|\/)gemini-/.test(modelId) && !/(^|\/)gemini-2\.0/.test(modelId);
}

/**
 * Create a Google provider instance.
 */
export function createGoogle(
  options: GoogleProviderSettings = {},
): GoogleProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ??
    'https://generativelanguage.googleapis.com/v1beta';

  const providerName = options.name ?? 'google.generative-ai';

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        'x-goog-api-key': loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'GOOGLE_GENERATIVE_AI_API_KEY',
          description: 'Google Generative AI',
        }),
        ...options.headers,
      },
      `ai-sdk/google/${VERSION}`,
    );

  const createChatModel = (modelId: GoogleModelId) =>
    new GoogleLanguageModel(modelId, {
      provider: providerName,
      baseURL,
      headers: getHeaders,
      generateId: options.generateId ?? generateId,
      supportedUrls: () => ({
        '*': [
          // Google Generative Language "files" endpoint
          // e.g. https://generativelanguage.googleapis.com/v1beta/files/...
          new RegExp(`^${baseURL}/files/.*$`),
          // YouTube URLs (public or unlisted videos)
          new RegExp(
            `^https://(?:www\\.)?youtube\\.com/watch\\?v=[\\w-]+(?:&[\\w=&.-]*)?$`,
          ),
          new RegExp(`^https://youtu\\.be/[\\w-]+(?:\\?[\\w=&.-]*)?$`),
        ],
        ...(supportsExternalFileUrls(modelId)
          ? Object.fromEntries(
              supportedExternalUrlMediaTypes.map(mediaType => [
                mediaType,
                [externalHttpsUrlPattern],
              ]),
            )
          : {}),
      }),
      fetch: options.fetch,
    });

  const createEmbeddingModel = (modelId: GoogleEmbeddingModelId) =>
    new GoogleEmbeddingModel(modelId, {
      provider: providerName,
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createImageModel = (
    modelId: GoogleImageModelId,
    settings: GoogleImageSettings = {},
  ) =>
    new GoogleImageModel(modelId, settings, {
      provider: providerName,
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createFiles = () =>
    new GoogleFiles({
      provider: providerName,
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createVideoModel = (modelId: GoogleVideoModelId) =>
    new GoogleVideoModel(modelId, {
      provider: providerName,
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      generateId: options.generateId ?? generateId,
    });

  const createRealtimeModel = (modelId: string) =>
    new GoogleRealtimeModel(modelId, {
      provider: `${providerName}.realtime`,
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createSpeechModel = (modelId: GoogleSpeechModelId) =>
    new GoogleSpeechModel(modelId, {
      provider: `${providerName}.speech`,
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const experimentalRealtimeFactory = Object.assign(
    (modelId: string) => createRealtimeModel(modelId),
    {
      getToken: async (tokenOptions: RealtimeFactoryV4GetTokenOptions) => {
        const model = createRealtimeModel(tokenOptions.model);
        const secret = await model.doCreateClientSecret({
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

  const createInteractionsModel = (
    modelIdOrAgent:
      | GoogleInteractionsModelId
      | { agent: GoogleInteractionsAgentName }
      | { managedAgent: string },
  ) =>
    new GoogleInteractionsLanguageModel(
      modelIdOrAgent as GoogleInteractionsModelInput,
      {
        provider: `${providerName}.interactions`,
        baseURL,
        headers: getHeaders,
        generateId: options.generateId ?? generateId,
        fetch: options.fetch,
      },
    );

  const provider = function (modelId: GoogleModelId) {
    if (new.target) {
      throw new Error(
        'The Google Generative AI model function cannot be called with the new keyword.',
      );
    }

    return createChatModel(modelId);
  };

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.generativeAI = createChatModel;
  provider.embedding = createEmbeddingModel;
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.image = createImageModel;
  provider.imageModel = createImageModel;
  provider.video = createVideoModel;
  provider.videoModel = createVideoModel;
  provider.experimental_realtime = experimentalRealtimeFactory;
  provider.files = createFiles;
  provider.speech = createSpeechModel;
  provider.speechModel = createSpeechModel;
  provider.interactions = createInteractionsModel;
  provider.tools = googleTools;

  return provider as GoogleProvider;
}

/**
 * Default Google Generative AI provider instance.
 */
export const google = createGoogle();
