import {
  type Experimental_RealtimeFactoryV4 as RealtimeFactoryV4,
  type Experimental_RealtimeFactoryV4GetTokenOptions as RealtimeFactoryV4GetTokenOptions,
  type Experimental_VideoModelV4,
  type FilesV4,
  type ImageModelV4,
  type LanguageModelV4,
  NoSuchModelError,
  type ProviderV4,
  type SpeechModelV4,
  type TranscriptionModelV4,
} from '@ai-sdk/provider';
import {
  generateId,
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
  type WebSocketConstructor,
} from '@ai-sdk/provider-utils';
import { XaiChatLanguageModel } from './xai-chat-language-model';
import type { XaiChatModelId } from './xai-chat-language-model-options';
import { XaiImageModel } from './xai-image-model';
import type { XaiImageModelId } from './xai-image-settings';
import { XaiResponsesLanguageModel } from './responses/xai-responses-language-model';
import type { XaiResponsesModelId } from './responses/xai-responses-language-model-options';
import { XaiRealtimeModel } from './realtime/xai-realtime-model';
import { xaiTools } from './tool';
import { VERSION } from './version';
import { XaiFiles } from './files/xai-files';
import { XaiVideoModel } from './xai-video-model';
import type { XaiVideoModelId } from './xai-video-settings';
import { XaiSpeechModel } from './xai-speech-model';
import { XaiTranscriptionModel } from './xai-transcription-model';

export interface XaiProvider extends ProviderV4 {
  (modelId: XaiResponsesModelId): LanguageModelV4;

  /**
   * Creates an Xai language model for text generation.
   */
  languageModel(modelId: XaiResponsesModelId): LanguageModelV4;

  /**
   * Creates an Xai chat model for text generation.
   */
  chat: (modelId: XaiChatModelId) => LanguageModelV4;

  /**
   * Creates an Xai responses model for text generation.
   */
  responses: (modelId: XaiResponsesModelId) => LanguageModelV4;

  /**
   * Creates an Xai image model for image generation.
   */
  image(modelId: XaiImageModelId): ImageModelV4;

  /**
   * Creates an Xai image model for image generation.
   */
  imageModel(modelId: XaiImageModelId): ImageModelV4;

  /**
   * Creates an Xai video model for video generation.
   */
  video(modelId: XaiVideoModelId): Experimental_VideoModelV4;

  /**
   * Creates an Xai video model for video generation.
   */
  videoModel(modelId: XaiVideoModelId): Experimental_VideoModelV4;

  experimental_realtime: RealtimeFactoryV4;

  /**
   * Creates an xAI model for speech generation (text-to-speech).
   */
  speech(): SpeechModelV4;

  /**
   * Creates an xAI model for speech generation (text-to-speech).
   */
  speechModel(): SpeechModelV4;

  /**
   * Creates an xAI model for speech-to-text transcription.
   */
  transcription(): TranscriptionModelV4;

  /**
   * Creates an xAI model for speech-to-text transcription.
   */
  transcriptionModel(): TranscriptionModelV4;

  /**
   * Returns the xAI files interface for uploading files.
   */
  files(): FilesV4;

  /**
   * Server-side agentic tools for use with the responses API.
   */
  tools: typeof xaiTools;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export interface XaiProviderSettings {
  /**
   * Base URL for the xAI API calls.
   */
  baseURL?: string;

  /**
   * API key for authenticating requests.
   */
  apiKey?: string;

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
   * Custom WebSocket implementation. Required in runtimes whose native
   * WebSocket constructor does not support headers for xAI streaming STT.
   */
  webSocket?: WebSocketConstructor;
}

export function createXai(options: XaiProviderSettings = {}): XaiProvider {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? 'https://api.x.ai/v1',
  );
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'XAI_API_KEY',
          description: 'xAI API key',
        })}`,
        ...options.headers,
      },
      `ai-sdk/xai/${VERSION}`,
    );

  const createChatLanguageModel = (modelId: XaiChatModelId) => {
    return new XaiChatLanguageModel(modelId, {
      provider: 'xai.chat',
      baseURL,
      headers: getHeaders,
      generateId,
      fetch: options.fetch,
    });
  };

  const createResponsesLanguageModel = (modelId: XaiResponsesModelId) => {
    return new XaiResponsesLanguageModel(modelId, {
      provider: 'xai.responses',
      baseURL,
      headers: getHeaders,
      generateId,
      fetch: options.fetch,
    });
  };

  const createImageModel = (modelId: XaiImageModelId) => {
    return new XaiImageModel(modelId, {
      provider: 'xai.image',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });
  };

  const createVideoModel = (modelId: XaiVideoModelId) => {
    return new XaiVideoModel(modelId, {
      provider: 'xai.video',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });
  };

  const createRealtimeModel = (modelId: string) => {
    return new XaiRealtimeModel(modelId, {
      provider: 'xai.realtime',
      baseURL: baseURL ?? 'https://api.x.ai/v1',
      headers: getHeaders,
      fetch: options.fetch,
    });
  };

  const createSpeechModel = () => {
    return new XaiSpeechModel('', {
      provider: 'xai.speech',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });
  };

  const createTranscriptionModel = () => {
    return new XaiTranscriptionModel('', {
      provider: 'xai.transcription',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      webSocket: options.webSocket,
    });
  };

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

  const createFiles = () =>
    new XaiFiles({
      provider: 'xai.files',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = (modelId: XaiResponsesModelId) =>
    createResponsesLanguageModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createResponsesLanguageModel;
  provider.chat = createChatLanguageModel;
  provider.responses = createResponsesLanguageModel;
  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };
  provider.textEmbeddingModel = provider.embeddingModel;
  provider.imageModel = createImageModel;
  provider.image = createImageModel;
  provider.videoModel = createVideoModel;
  provider.video = createVideoModel;
  provider.experimental_realtime = experimentalRealtimeFactory;
  provider.speechModel = createSpeechModel;
  provider.speech = createSpeechModel;
  provider.transcriptionModel = createTranscriptionModel;
  provider.transcription = createTranscriptionModel;
  provider.files = createFiles;
  provider.tools = xaiTools;

  return provider;
}

export const xai = createXai();
