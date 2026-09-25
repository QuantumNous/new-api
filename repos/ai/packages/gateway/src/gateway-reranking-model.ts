import type {
  RerankingModelV4,
  SharedV4ProviderMetadata,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  lazySchema,
  postJsonToApi,
  resolve,
  zodSchema,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { asGatewayError } from './errors';
import { parseAuthMethod } from './errors/parse-auth-method';
import type { GatewayConfig } from './gateway-config';

export class GatewayRerankingModel implements RerankingModelV4 {
  readonly specificationVersion = 'v4';

  constructor(
    readonly modelId: string,
    private readonly config: GatewayConfig & {
      provider: string;
      o11yHeaders: Resolvable<Record<string, string>>;
    },
  ) {}

  get provider(): string {
    return this.config.provider;
  }

  async doRerank({
    documents,
    query,
    topN,
    headers,
    abortSignal,
    providerOptions,
  }: Parameters<RerankingModelV4['doRerank']>[0]): Promise<
    Awaited<ReturnType<RerankingModelV4['doRerank']>>
  > {
    const resolvedHeaders = this.config.headers
      ? await resolve(this.config.headers)
      : undefined;
    try {
      const {
        responseHeaders,
        value: responseBody,
        rawValue,
      } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(
          resolvedHeaders,
          headers ?? {},
          this.getModelConfigHeaders(),
          await resolve(this.config.o11yHeaders),
        ),
        body: {
          documents,
          query,
          ...(topN != null ? { topN } : {}),
          ...(providerOptions ? { providerOptions } : {}),
        },
        successfulResponseHandler: createJsonResponseHandler(
          gatewayRerankingResponseSchema,
        ),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: data => data,
        }),
        ...(abortSignal && { abortSignal }),
        fetch: this.config.fetch,
      });

      return {
        ranking: responseBody.ranking,
        providerMetadata:
          responseBody.providerMetadata as unknown as SharedV4ProviderMetadata,
        response: { headers: responseHeaders, body: rawValue },
        warnings: responseBody.warnings ?? [],
      };
    } catch (error) {
      throw await asGatewayError(
        error,
        await parseAuthMethod(resolvedHeaders ?? {}),
      );
    }
  }

  private getUrl() {
    return `${this.config.baseURL}/reranking-model`;
  }

  private getModelConfigHeaders() {
    return {
      'ai-reranking-model-specification-version': '4',
      'ai-model-id': this.modelId,
    };
  }
}

const gatewayRerankingWarningSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('unsupported'),
    feature: z.string(),
    details: z.string().optional(),
  }),
  z.object({
    type: z.literal('compatibility'),
    feature: z.string(),
    details: z.string().optional(),
  }),
  z.object({
    type: z.literal('deprecated'),
    setting: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('other'),
    message: z.string(),
  }),
]);

const gatewayRerankingResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      ranking: z.array(
        z.object({
          index: z.number(),
          relevanceScore: z.number(),
        }),
      ),
      warnings: z.array(gatewayRerankingWarningSchema).optional(),
      providerMetadata: z
        .record(z.string(), z.record(z.string(), z.unknown()))
        .optional(),
    }),
  ),
);
