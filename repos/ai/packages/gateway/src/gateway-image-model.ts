import type {
  ImageModelV4,
  ImageModelV4File,
  ImageModelV4ProviderMetadata,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertUint8ArrayToBase64,
  createJsonResponseHandler,
  createJsonErrorResponseHandler,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { GatewayConfig } from './gateway-config';
import { asGatewayError } from './errors';
import { parseAuthMethod } from './errors/parse-auth-method';

type GatewayImageConfig = GatewayConfig & {
  provider: string;
  o11yHeaders: Resolvable<Record<string, string>>;
};

export class GatewayImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4' as const;
  // Set a very large number to prevent client-side splitting of requests
  readonly maxImagesPerCall = Number.MAX_SAFE_INTEGER;

  static [WORKFLOW_SERIALIZE](model: GatewayImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: GatewayImageConfig;
  }) {
    return new GatewayImageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: string,
    private readonly config: GatewayImageConfig,
  ) {}

  get provider(): string {
    return this.config.provider;
  }

  async doGenerate({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    files,
    mask,
    providerOptions,
    headers,
    abortSignal,
  }: Parameters<ImageModelV4['doGenerate']>[0]): Promise<
    Awaited<ReturnType<ImageModelV4['doGenerate']>>
  > {
    const resolvedHeaders = this.config.headers
      ? await resolve(this.config.headers)
      : undefined;
    try {
      const { responseHeaders, value: responseBody } = await postJsonToApi({
        url: this.getUrl(),
        headers: combineHeaders(
          resolvedHeaders,
          headers ?? {},
          this.getModelConfigHeaders(),
          await resolve(this.config.o11yHeaders),
        ),
        body: {
          prompt,
          n,
          ...(size && { size }),
          ...(aspectRatio && { aspectRatio }),
          ...(seed && { seed }),
          ...(providerOptions && { providerOptions }),
          ...(files && {
            files: files.map(file => maybeEncodeImageFile(file)),
          }),
          ...(mask && { mask: maybeEncodeImageFile(mask) }),
        },
        successfulResponseHandler: createJsonResponseHandler(
          gatewayImageResponseSchema,
        ),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: data => data,
        }),
        ...(abortSignal && { abortSignal }),
        fetch: this.config.fetch,
      });

      return {
        images: responseBody.images, // Always base64 strings from server
        warnings: responseBody.warnings ?? [],
        providerMetadata:
          responseBody.providerMetadata as ImageModelV4ProviderMetadata,
        response: {
          timestamp: new Date(),
          modelId: this.modelId,
          headers: responseHeaders,
        },
        ...(responseBody.usage != null && {
          usage: {
            inputTokens: responseBody.usage.inputTokens ?? undefined,
            outputTokens: responseBody.usage.outputTokens ?? undefined,
            totalTokens: responseBody.usage.totalTokens ?? undefined,
          },
        }),
      };
    } catch (error) {
      throw await asGatewayError(
        error,
        await parseAuthMethod(resolvedHeaders ?? {}),
      );
    }
  }

  private getUrl() {
    return `${this.config.baseURL}/image-model`;
  }

  private getModelConfigHeaders() {
    return {
      'ai-image-model-specification-version': '4',
      'ai-model-id': this.modelId,
    };
  }
}

function maybeEncodeImageFile(file: ImageModelV4File) {
  if (file.type === 'file' && file.data instanceof Uint8Array) {
    return {
      ...file,
      data: convertUint8ArrayToBase64(file.data),
    };
  }
  return file;
}

const providerMetadataEntrySchema = z
  .object({
    images: z.array(z.unknown()).optional(),
  })
  .catchall(z.unknown());

const gatewayImageWarningSchema = z.discriminatedUnion('type', [
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

const gatewayImageUsageSchema = z.object({
  inputTokens: z.number().nullish(),
  outputTokens: z.number().nullish(),
  totalTokens: z.number().nullish(),
});

const gatewayImageResponseSchema = z.object({
  images: z.array(z.string()), // Always base64 strings over the wire
  warnings: z.array(gatewayImageWarningSchema).optional(),
  providerMetadata: z
    .record(z.string(), providerMetadataEntrySchema)
    .optional(),
  usage: gatewayImageUsageSchema.optional(),
});
