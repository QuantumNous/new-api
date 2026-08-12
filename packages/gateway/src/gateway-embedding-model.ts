import type {
  EmbeddingModelV4,
  SharedV4ProviderMetadata,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  lazySchema,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  zodSchema,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { asGatewayError } from './errors';
import { parseAuthMethod } from './errors/parse-auth-method';
import type { GatewayConfig } from './gateway-config';

type GatewayEmbeddingConfig = GatewayConfig & {
  provider: string;
  o11yHeaders: Resolvable<Record<string, string>>;
};

export class GatewayEmbeddingModel implements EmbeddingModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxEmbeddingsPerCall = 2048;
  readonly supportsParallelCalls = true;

  static [WORKFLOW_SERIALIZE](model: GatewayEmbeddingModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: GatewayEmbeddingConfig;
  }) {
    return new GatewayEmbeddingModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: string,
    private readonly config: GatewayEmbeddingConfig,
  ) {}

  get provider(): string {
    return this.config.provider;
  }

  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions,
  }: Parameters<EmbeddingModelV4['doEmbed']>[0]): Promise<
    Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>
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
          values,
          ...(providerOptions ? { providerOptions } : {}),
        },
        successfulResponseHandler: createJsonResponseHandler(
          gatewayEmbeddingResponseSchema,
        ),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: data => data,
        }),
        ...(abortSignal && { abortSignal }),
        fetch: this.config.fetch,
      });

      return {
        embeddings: responseBody.embeddings,
        usage: responseBody.usage ?? undefined,
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
    return `${this.config.baseURL}/embedding-model`;
  }

  private getModelConfigHeaders() {
    return {
      'ai-embedding-model-specification-version': '4',
      'ai-model-id': this.modelId,
    };
  }
}

const gatewayEmbeddingWarningSchema = z.discriminatedUnion('type', [
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

const gatewayEmbeddingResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      embeddings: z.array(z.array(z.number())),
      usage: z.object({ tokens: z.number() }).nullish(),
      warnings: z.array(gatewayEmbeddingWarningSchema).optional(),
      providerMetadata: z
        .record(z.string(), z.record(z.string(), z.unknown()))
        .optional(),
    }),
  ),
);
