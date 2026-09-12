import {
  NoSuchModelError,
  type TranscriptionModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { GladiaTranscriptionModel } from './gladia-transcription-model';
import { VERSION } from './version';

export interface GladiaProvider extends ProviderV4 {
  (): {
    transcription: GladiaTranscriptionModel;
  };

  /**
   * Creates a model for transcription.
   */
  transcription(): TranscriptionModelV4;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export interface GladiaProviderSettings {
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
 * Create a Gladia provider instance.
 */
export function createGladia(
  options: GladiaProviderSettings = {},
): GladiaProvider {
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        'x-gladia-key': loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'GLADIA_API_KEY',
          description: 'Gladia',
        }),
        ...options.headers,
      },
      `ai-sdk/gladia/${VERSION}`,
    );

  const createTranscriptionModel = () =>
    new GladiaTranscriptionModel('default', {
      provider: `gladia.transcription`,
      url: ({ path }) => `https://api.gladia.io${path}`,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = function () {
    return {
      transcription: createTranscriptionModel(),
    };
  };

  provider.specificationVersion = 'v4' as const;
  provider.transcription = createTranscriptionModel;
  provider.transcriptionModel = createTranscriptionModel;

  // Required ProviderV4 methods that are not supported
  provider.languageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'languageModel',
      message: 'Gladia does not provide language models',
    });
  };

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
      message: 'Gladia does not provide embedding models',
    });
  };
  provider.textEmbeddingModel = provider.embeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message: 'Gladia does not provide image models',
    });
  };

  return provider as GladiaProvider;
}

/**
 * Default Gladia provider instance.
 */
export const gladia = createGladia();
