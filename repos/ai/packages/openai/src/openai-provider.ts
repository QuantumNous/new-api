import type {
  EmbeddingModelV4,
  FilesV4,
  ImageModelV4,
  LanguageModelV4,
  ProviderV4,
  Experimental_RealtimeFactoryV4 as RealtimeFactoryV4,
  Experimental_RealtimeFactoryV4GetTokenOptions as RealtimeFactoryV4GetTokenOptions,
  SpeechModelV4,
  SkillsV4,
  TranscriptionModelV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  loadOptionalSetting,
  validateBaseURL,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
  type WebSocketConstructor,
} from '@ai-sdk/provider-utils';
import { OpenAIChatLanguageModel } from './chat/openai-chat-language-model';
import type { OpenAIChatModelId } from './chat/openai-chat-language-model-options';
import { OpenAICompletionLanguageModel } from './completion/openai-completion-language-model';
import type { OpenAICompletionModelId } from './completion/openai-completion-language-model-options';
import { OpenAIEmbeddingModel } from './embedding/openai-embedding-model';
import { OpenAIFiles } from './files/openai-files';
import type { OpenAIEmbeddingModelId } from './embedding/openai-embedding-model-options';
import { OpenAIImageModel } from './image/openai-image-model';
import type { OpenAIImageModelId } from './image/openai-image-model-options';
import { openaiTools } from './openai-tools';
import { OpenAIRealtimeModel } from './realtime/openai-realtime-model';
import { OpenAIResponsesLanguageModel } from './responses/openai-responses-language-model';
import type { OpenAIResponsesModelId } from './responses/openai-responses-language-model-options';
import { OpenAISpeechModel } from './speech/openai-speech-model';
import type { OpenAISpeechModelId } from './speech/openai-speech-model-options';
import { OpenAITranscriptionModel } from './transcription/openai-transcription-model';
import type { OpenAITranscriptionModelId } from './transcription/openai-transcription-model-options';
import { OpenAISkills } from './skills/openai-skills';
import { VERSION } from './version';

export interface OpenAIProvider extends ProviderV4 {
  (modelId: OpenAIResponsesModelId): LanguageModelV4;

  /**
   * Creates an OpenAI model for text generation.
   */
  languageModel(modelId: OpenAIResponsesModelId): LanguageModelV4;

  /**
   * Creates an OpenAI chat model for text generation.
   */
  chat(modelId: OpenAIChatModelId): LanguageModelV4;

  /**
   * Creates an OpenAI responses API model for text generation.
   */
  responses(modelId: OpenAIResponsesModelId): LanguageModelV4;

  /**
   * Creates an OpenAI completion model for text generation.
   */
  completion(modelId: OpenAICompletionModelId): LanguageModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embedding(modelId: OpenAIEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for text embeddings.
   */
  embeddingModel(modelId: OpenAIEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embedding` instead.
   */
  textEmbedding(modelId: OpenAIEmbeddingModelId): EmbeddingModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: OpenAIEmbeddingModelId): EmbeddingModelV4;

  /**
   * Creates a model for image generation.
   */
  image(modelId: OpenAIImageModelId): ImageModelV4;

  /**
   * Creates a model for image generation.
   */
  imageModel(modelId: OpenAIImageModelId): ImageModelV4;

  /**
   * Creates a model for transcription.
   */
  transcription(modelId: OpenAITranscriptionModelId): TranscriptionModelV4;

  /**
   * Creates a model for speech generation.
   */
  speech(modelId: OpenAISpeechModelId): SpeechModelV4;

  /**
   * Creates an experimental realtime model for bidirectional audio/text
   * communication over WebSocket.
   */
  experimental_realtime: RealtimeFactoryV4;

  /**
   * Returns a FilesV4 interface for uploading files to OpenAI.
   */
  files(): FilesV4;

  /**
   * Returns a SkillsV4 interface for uploading skills to OpenAI.
   */
  skills(): SkillsV4;

  /**
   * OpenAI-specific tools.
   */
  tools: typeof openaiTools;
}

export interface OpenAIProviderSettings {
  /**
   * Base URL for the OpenAI API calls.
   */
  baseURL?: string;

  /**
   * API key for authenticating requests.
   */
  apiKey?: string;

  /**
   * OpenAI Organization.
   */
  organization?: string;

  /**
   * OpenAI project.
   */
  project?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;

  /**
   * Provider name. Overrides the `openai` default name for 3rd party providers.
   */
  name?: string;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;

  /**
   * Custom WebSocket implementation. This is useful for testing or for
   * runtimes that need a WebSocket constructor with header support.
   */
  webSocket?: WebSocketConstructor;
}

/**
 * Create an OpenAI provider instance.
 */
export function createOpenAI(
  options: OpenAIProviderSettings = {},
): OpenAIProvider {
  const baseURL =
    withoutTrailingSlash(
      validateBaseURL(
        loadOptionalSetting({
          settingValue: options.baseURL,
          environmentVariableName: 'OPENAI_BASE_URL',
        }),
      ),
    ) ?? 'https://api.openai.com/v1';

  const providerName = options.name ?? 'openai';

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'OPENAI_API_KEY',
          description: 'OpenAI',
        })}`,
        'OpenAI-Organization': options.organization,
        'OpenAI-Project': options.project,
        ...options.headers,
      },
      `ai-sdk/openai/${VERSION}`,
    );

  const createChatModel = (modelId: OpenAIChatModelId) =>
    new OpenAIChatLanguageModel(modelId, {
      provider: `${providerName}.chat`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createCompletionModel = (modelId: OpenAICompletionModelId) =>
    new OpenAICompletionLanguageModel(modelId, {
      provider: `${providerName}.completion`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createEmbeddingModel = (modelId: OpenAIEmbeddingModelId) =>
    new OpenAIEmbeddingModel(modelId, {
      provider: `${providerName}.embedding`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createImageModel = (modelId: OpenAIImageModelId) =>
    new OpenAIImageModel(modelId, {
      provider: `${providerName}.image`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createTranscriptionModel = (modelId: OpenAITranscriptionModelId) =>
    new OpenAITranscriptionModel(modelId, {
      provider: `${providerName}.transcription`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      webSocket: options.webSocket,
    });

  const createSpeechModel = (modelId: OpenAISpeechModelId) =>
    new OpenAISpeechModel(modelId, {
      provider: `${providerName}.speech`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createFiles = () =>
    new OpenAIFiles({
      provider: `${providerName}.files`,
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createSkills = () =>
    new OpenAISkills({
      provider: `${providerName}.skills`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createLanguageModel = (modelId: OpenAIResponsesModelId) => {
    if (new.target) {
      throw new Error(
        'The OpenAI model function cannot be called with the new keyword.',
      );
    }

    return createResponsesModel(modelId);
  };

  const createResponsesModel = (modelId: OpenAIResponsesModelId) => {
    return new OpenAIResponsesLanguageModel(modelId, {
      provider: `${providerName}.responses`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      // Soft-deprecated. TODO: remove in v8
      fileIdPrefixes: ['file-'],
    });
  };

  const createRealtimeModel = (modelId: string) =>
    new OpenAIRealtimeModel(modelId, {
      provider: `${providerName}.realtime`,
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

  const provider = function (modelId: OpenAIResponsesModelId) {
    return createLanguageModel(modelId);
  };

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.completion = createCompletionModel;
  provider.responses = createResponsesModel;
  provider.embedding = createEmbeddingModel;
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;

  provider.image = createImageModel;
  provider.imageModel = createImageModel;

  provider.transcription = createTranscriptionModel;
  provider.transcriptionModel = createTranscriptionModel;

  provider.speech = createSpeechModel;
  provider.speechModel = createSpeechModel;
  provider.files = createFiles;
  provider.skills = createSkills;

  provider.experimental_realtime = experimentalRealtimeFactory;

  provider.tools = openaiTools;

  return provider as OpenAIProvider;
}

/**
 * Default OpenAI provider instance.
 */
export const openai = createOpenAI();
