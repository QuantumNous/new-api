import {
  NoSuchModelError,
  type EmbeddingModelV4,
  type RerankingModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import {
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { VoyageEmbeddingModel } from './voyage-embedding-model';
import type { VoyageEmbeddingModelId } from './voyage-embedding-model-options';
import type { VoyageRerankingModelId } from './reranking/voyage-reranking-model-options';
import { VoyageRerankingModel } from './reranking/voyage-reranking-model';
import { VERSION } from './version';

export interface VoyageProvider extends ProviderV4 {
  embedding(modelId: VoyageEmbeddingModelId): EmbeddingModelV4;
  embeddingModel(modelId: VoyageEmbeddingModelId): EmbeddingModelV4;
  textEmbedding(modelId: VoyageEmbeddingModelId): EmbeddingModelV4;
  textEmbeddingModel(modelId: VoyageEmbeddingModelId): EmbeddingModelV4;
  reranking(modelId: VoyageRerankingModelId): RerankingModelV4;
  rerankingModel(modelId: VoyageRerankingModelId): RerankingModelV4;
}

export interface VoyageProviderSettings {
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  fetch?: FetchFunction;
}

export function createVoyage(
  options: VoyageProviderSettings = {},
): VoyageProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ?? 'https://api.voyageai.com/v1';

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'VOYAGE_API_KEY',
          description: 'Voyage',
        })}`,
        ...options.headers,
      },
      `ai-sdk/voyage/${VERSION}`,
    );

  const createEmbeddingModel = (modelId: VoyageEmbeddingModelId) =>
    new VoyageEmbeddingModel(modelId, {
      provider: 'voyage.embedding',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createRerankingModel = (modelId: VoyageRerankingModelId) =>
    new VoyageRerankingModel(modelId, {
      provider: 'voyage.reranking',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider: VoyageProvider = {
    specificationVersion: 'v4' as const,
    embedding: createEmbeddingModel,
    embeddingModel: createEmbeddingModel,
    textEmbedding: createEmbeddingModel,
    textEmbeddingModel: createEmbeddingModel,
    reranking: createRerankingModel,
    rerankingModel: createRerankingModel,

    languageModel: (modelId: string) => {
      throw new NoSuchModelError({ modelId, modelType: 'languageModel' });
    },

    imageModel: (modelId: string) => {
      throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
    },
  };

  return provider;
}

export const voyage = createVoyage();
