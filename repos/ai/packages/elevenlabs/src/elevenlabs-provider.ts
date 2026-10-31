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
import { ElevenLabsTranscriptionModel } from './elevenlabs-transcription-model';
import type { ElevenLabsTranscriptionModelId } from './elevenlabs-transcription-options';
import { ElevenLabsSpeechModel } from './elevenlabs-speech-model';
import type { ElevenLabsSpeechModelId } from './elevenlabs-speech-options';
import { VERSION } from './version';

export interface ElevenLabsProvider extends ProviderV4 {
  (
    modelId: ElevenLabsTranscriptionModelId,
    settings?: {},
  ): {
    transcription: ElevenLabsTranscriptionModel;
  };

  /**
   * Creates a model for transcription.
   */
  transcription(modelId: ElevenLabsTranscriptionModelId): TranscriptionModelV4;

  /**
   * Creates a model for speech generation.
   */
  speech(modelId: ElevenLabsSpeechModelId): SpeechModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export interface ElevenLabsProviderSettings {
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
 * Create an ElevenLabs provider instance.
 */
export function createElevenLabs(
  options: ElevenLabsProviderSettings = {},
): ElevenLabsProvider {
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        'xi-api-key': loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'ELEVENLABS_API_KEY',
          description: 'ElevenLabs',
        }),
        ...options.headers,
      },
      `ai-sdk/elevenlabs/${VERSION}`,
    );

  const createTranscriptionModel = (modelId: ElevenLabsTranscriptionModelId) =>
    new ElevenLabsTranscriptionModel(modelId, {
      provider: `elevenlabs.transcription`,
      url: ({ path }) => `https://api.elevenlabs.io${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createSpeechModel = (modelId: ElevenLabsSpeechModelId) =>
    new ElevenLabsSpeechModel(modelId, {
      provider: `elevenlabs.speech`,
      url: ({ path }) => `https://api.elevenlabs.io${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = function (modelId: ElevenLabsTranscriptionModelId) {
    return {
      transcription: createTranscriptionModel(modelId),
    };
  };

  provider.specificationVersion = 'v4' as const;
  provider.transcription = createTranscriptionModel;
  provider.transcriptionModel = createTranscriptionModel;
  provider.speech = createSpeechModel;
  provider.speechModel = createSpeechModel;

  provider.languageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'languageModel',
      message: 'ElevenLabs does not provide language models',
    });
  };

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
      message: 'ElevenLabs does not provide embedding models',
    });
  };
  provider.textEmbeddingModel = provider.embeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message: 'ElevenLabs does not provide image models',
    });
  };

  return provider as ElevenLabsProvider;
}

/**
 * Default ElevenLabs provider instance.
 */
export const elevenLabs = createElevenLabs();
