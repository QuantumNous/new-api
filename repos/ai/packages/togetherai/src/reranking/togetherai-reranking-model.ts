import type { RerankingModelV4 } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import {
  togetheraiErrorSchema,
  togetheraiRerankingResponseSchema,
  type TogetherAIRerankingInput,
} from './togetherai-reranking-api';
import {
  togetheraiRerankingModelOptionsSchema,
  type TogetherAIRerankingModelId,
} from './togetherai-reranking-model-options';
type TogetherAIRerankingConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class TogetherAIRerankingModel implements RerankingModelV4 {
  readonly specificationVersion = 'v4';
  readonly modelId: TogetherAIRerankingModelId;

  private readonly config: TogetherAIRerankingConfig;

  constructor(
    modelId: TogetherAIRerankingModelId,
    config: TogetherAIRerankingConfig,
  ) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  // see https://docs.together.ai/reference/rerank-1
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
      provider: 'togetherai',
      providerOptions,
      schema: togetheraiRerankingModelOptionsSchema,
    });

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/rerank`,
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        model: this.modelId,
        documents: documents.values,
        query,
        top_n: topN,
        rank_fields: rerankingOptions?.rankFields,
        return_documents: false, // reduce response size
      } satisfies TogetherAIRerankingInput,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: togetheraiErrorSchema,
        errorToMessage: data => data.error.message,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        togetheraiRerankingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      ranking: response.results.map(result => ({
        index: result.index,
        relevanceScore: result.relevance_score,
      })),
      response: {
        id: response.id ?? undefined,
        modelId: response.model ?? undefined,
        headers: responseHeaders,
        body: rawValue,
      },
    };
  }
}
