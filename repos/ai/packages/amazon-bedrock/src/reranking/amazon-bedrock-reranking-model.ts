import type { RerankingModelV4 } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { AmazonBedrockErrorSchema } from '../amazon-bedrock-error';
import {
  amazonBedrockRerankingResponseSchema,
  type AmazonBedrockRerankingInput,
} from './amazon-bedrock-reranking-api';
import {
  amazonBedrockRerankingModelOptionsSchema,
  type AmazonBedrockRerankingModelId,
} from './amazon-bedrock-reranking-model-options';
type AmazonBedrockRerankingConfig = {
  baseUrl: () => string;
  region: string;
  headers: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
};

type DoRerankResponse = Awaited<ReturnType<RerankingModelV4['doRerank']>>;

export class AmazonBedrockRerankingModel implements RerankingModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider = 'amazon-bedrock';

  constructor(
    readonly modelId: AmazonBedrockRerankingModelId,
    private readonly config: AmazonBedrockRerankingConfig,
  ) {}

  async doRerank({
    documents,
    headers,
    query,
    topN,
    abortSignal,
    providerOptions,
  }: Parameters<RerankingModelV4['doRerank']>[0]): Promise<DoRerankResponse> {
    // Prefer `amazonBedrock`; fall back to legacy `bedrock` for backward
    // compatibility.
    const amazonBedrockOptions =
      (await parseProviderOptions({
        provider: 'amazonBedrock',
        providerOptions,
        schema: amazonBedrockRerankingModelOptionsSchema,
      })) ??
      (await parseProviderOptions({
        provider: 'bedrock',
        providerOptions,
        schema: amazonBedrockRerankingModelOptionsSchema,
      }));

    const {
      value: response,
      responseHeaders,
      rawValue,
    } = await postJsonToApi({
      url: `${this.config.baseUrl()}/rerank`,
      headers: await resolve(
        combineHeaders(await resolve(this.config.headers), headers),
      ),
      body: {
        nextToken: amazonBedrockOptions?.nextToken,
        queries: [
          {
            textQuery: { text: query },
            type: 'TEXT',
          },
        ],
        rerankingConfiguration: {
          bedrockRerankingConfiguration: {
            modelConfiguration: {
              modelArn: `arn:aws:bedrock:${this.config.region}::foundation-model/${this.modelId}`,
              additionalModelRequestFields:
                amazonBedrockOptions?.additionalModelRequestFields,
            },
            numberOfResults: topN,
          },
          type: 'BEDROCK_RERANKING_MODEL',
        },
        sources: documents.values.map(value => ({
          type: 'INLINE' as const,
          inlineDocumentSource:
            documents.type === 'text'
              ? {
                  type: 'TEXT' as const,
                  textDocument: { text: value as string },
                }
              : {
                  type: 'JSON' as const,
                  jsonDocument: value,
                },
        })),
      } satisfies AmazonBedrockRerankingInput,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: AmazonBedrockErrorSchema,
        errorToMessage: error => `${error.type}: ${error.message}`,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        amazonBedrockRerankingResponseSchema,
      ),
      fetch: this.config.fetch,
      abortSignal,
    });

    return {
      ranking: response.results,
      response: {
        headers: responseHeaders,
        body: rawValue,
      },
    };
  }
}
