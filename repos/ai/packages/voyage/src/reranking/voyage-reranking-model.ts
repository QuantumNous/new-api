import type { RerankingModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  lazySchema,
  parseProviderOptions,
  postJsonToApi,
  zodSchema,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { voyageFailedResponseHandler } from '../voyage-error';
import {
  voyageRerankingModelOptionsSchema,
  type VoyageRerankingModelId,
} from './voyage-reranking-model-options';
type VoyageRerankingConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class VoyageRerankingModel implements RerankingModelV4 {
  readonly specificationVersion = 'v4';
  readonly modelId: VoyageRerankingModelId;

  private readonly config: VoyageRerankingConfig;

  constructor(modelId: VoyageRerankingModelId, config: VoyageRerankingConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  async doRerank({
    documents,
    headers,
    query,
    topN,
    abortSignal,
    providerOptions,
  }: Parameters<RerankingModelV4['doRerank']>[0]): Promise<
    Awaited<ReturnType<RerankingModelV4['doRerank']>>
  > {
    const rerankingOptions = await parseProviderOptions({
      provider: 'voyage',
      providerOptions,
      schema: voyageRerankingModelOptionsSchema,
    });

    const warnings: SharedV4Warning[] = [];

    if (documents.type === 'object') {
      warnings.push({
        type: 'compatibility',
        feature: 'object documents',
        details: 'Object documents are converted to strings.',
      });
    }

    const stringValues =
      documents.type === 'text'
        ? documents.values
        : documents.values.map(value => JSON.stringify(value));

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/rerank`,
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        query,
        documents: stringValues,
        model: this.modelId,
        top_k: topN,
        return_documents: rerankingOptions?.returnDocuments,
        truncation: rerankingOptions?.truncation,
      },
      failedResponseHandler: voyageFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        voyageRerankingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      ranking: response.data.map(result => ({
        index: result.index,
        relevanceScore: result.relevance_score,
      })),
      warnings,
      response: {
        headers: responseHeaders,
        body: rawValue,
      },
    };
  }
}

const voyageRerankingResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      data: z.array(
        z.object({
          index: z.number(),
          relevance_score: z.number(),
        }),
      ),
    }),
  ),
);
