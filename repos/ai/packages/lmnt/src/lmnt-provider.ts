import {
  NoSuchModelError,
  type SpeechModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { LMNTSpeechModel } from './lmnt-speech-model';
import type { LMNTSpeechModelId } from './lmnt-speech-options';
import { VERSION } from './version';

export interface LMNTProvider extends ProviderV4 {
  (
    modelId: 'aurora',
    settings?: {},
  ): {
    speech: LMNTSpeechModel;
  };

  /**
   * Creates a model for speech synthesis.
   */
  speech(modelId: LMNTSpeechModelId): SpeechModelV4;
}

export interface LMNTProviderSettings {
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
 * Create an LMNT provider instance.
 */
export function createLMNT(options: LMNTProviderSettings = {}): LMNTProvider {
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        'x-api-key': loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'LMNT_API_KEY',
          description: 'LMNT',
        }),
        ...options.headers,
      },
      `ai-sdk/lmnt/${VERSION}`,
    );

  const createSpeechModel = (modelId: LMNTSpeechModelId) =>
    new LMNTSpeechModel(modelId, {
      provider: `lmnt.speech`,
      url: ({ path }) => `https://api.lmnt.com${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = function (modelId: LMNTSpeechModelId) {
    return {
      speech: createSpeechModel(modelId),
    };
  };

  provider.specificationVersion = 'v4' as const;
  provider.speech = createSpeechModel;
  provider.speechModel = createSpeechModel;

  provider.languageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'languageModel',
      message: 'LMNT does not provide language models',
    });
  };

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
      message: 'LMNT does not provide embedding models',
    });
  };

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message: 'LMNT does not provide image models',
    });
  };

  return provider as LMNTProvider;
}

/**
 * Default LMNT provider instance.
 */
export const lmnt = createLMNT();
