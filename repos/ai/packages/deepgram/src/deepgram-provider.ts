import {
  NoSuchModelError,
  type TranscriptionModelV4,
  type SpeechModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { DeepgramTranscriptionModel } from './deepgram-transcription-model';
import type { DeepgramTranscriptionModelId } from './deepgram-transcription-options';
import { DeepgramSpeechModel } from './deepgram-speech-model';
import type { DeepgramSpeechModelId } from './deepgram-speech-options';
import { VERSION } from './version';

export interface DeepgramProvider extends ProviderV4 {
  (
    modelId: 'nova-3',
    settings?: {},
  ): {
    transcription: DeepgramTranscriptionModel;
  };

  /**
   * Creates a model for transcription.
   */
  transcription(modelId: DeepgramTranscriptionModelId): TranscriptionModelV4;

  /**
   * Creates a model for speech generation.
   */
  speech(modelId: DeepgramSpeechModelId): SpeechModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export interface DeepgramProviderSettings {
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
}

/**
 * Create an Deepgram provider instance.
 */
export function createDeepgram(
  options: DeepgramProviderSettings = {},
): DeepgramProvider {
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        authorization: `Token ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'DEEPGRAM_API_KEY',
          description: 'Deepgram',
        })}`,
        ...options.headers,
      },
      `ai-sdk/deepgram/${VERSION}`,
    );

  const createTranscriptionModel = (modelId: DeepgramTranscriptionModelId) =>
    new DeepgramTranscriptionModel(modelId, {
      provider: `deepgram.transcription`,
      url: ({ path }) => `https://api.deepgram.com${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createSpeechModel = (modelId: DeepgramSpeechModelId) =>
    new DeepgramSpeechModel(modelId, {
      provider: `deepgram.speech`,
      url: ({ path }) => `https://api.deepgram.com${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = function (modelId: DeepgramTranscriptionModelId) {
    return {
      transcription: createTranscriptionModel(modelId),
    };
  };

  provider.specificationVersion = 'v4' as const;
  provider.transcription = createTranscriptionModel;
  provider.transcriptionModel = createTranscriptionModel;
  provider.speech = createSpeechModel;
  provider.speechModel = createSpeechModel;

  // Required ProviderV4 methods that are not supported
  provider.languageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'languageModel',
      message: 'Deepgram does not provide language models',
    });
  };

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
      message: 'Deepgram does not provide text embedding models',
    });
  };
  provider.textEmbeddingModel = provider.embeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message: 'Deepgram does not provide image models',
    });
  };

  return provider as DeepgramProvider;
}

/**
 * Default Deepgram provider instance.
 */
export const deepgram = createDeepgram();
