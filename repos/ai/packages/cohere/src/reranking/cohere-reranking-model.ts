import type { RerankingModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { cohereFailedResponseHandler } from '../cohere-error';
import {
  cohereRerankingResponseSchema,
  type CohereRerankingInput,
} from './cohere-reranking-api';
import {
  cohereRerankingModelOptionsSchema,
  type CohereRerankingModelId,
} from './cohere-reranking-model-options';
type CohereRerankingConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class CohereRerankingModel implements RerankingModelV4 {
  readonly specificationVersion = 'v4';
  readonly modelId: CohereRerankingModelId;

  private readonly config: CohereRerankingConfig;

  constructor(modelId: CohereRerankingModelId, config: CohereRerankingConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  // current implementation is based on v2 of the API: https://docs.cohere.com/v2/reference/rerank
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
      provider: 'cohere',
      providerOptions,
      schema: cohereRerankingModelOptionsSchema,
    });

    const warnings: SharedV4Warning[] = [];

    if (documents.type === 'object') {
      warnings.push({
        type: 'compatibility',
        feature: 'object documents',
        details: 'Object documents are converted to strings.',
      });
    }

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/rerank`,
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        model: this.modelId,
        query,
        documents:
          documents.type === 'text'
            ? documents.values
            : documents.values.map(value => JSON.stringify(value)),
        top_n: topN,
        max_tokens_per_doc: rerankingOptions?.maxTokensPerDoc,
        priority: rerankingOptions?.priority,
      } satisfies CohereRerankingInput,
      failedResponseHandler: cohereFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        cohereRerankingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      ranking: response.results.map(result => ({
        index: result.index,
        relevanceScore: result.relevance_score,
      })),
      warnings,
      response: {
        id: response.id ?? undefined,
        headers: responseHeaders,
        body: rawValue,
      },
    };
  }
}
