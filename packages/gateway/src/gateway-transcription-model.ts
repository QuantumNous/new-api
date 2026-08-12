import type {
  SharedV4ProviderMetadata,
  SharedV4Warning,
  TranscriptionModelV4,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertUint8ArrayToBase64,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  postJsonToApi,
  resolve,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { asGatewayError } from './errors';
import { parseAuthMethod } from './errors/parse-auth-method';
import type { GatewayConfig } from './gateway-config';

export class GatewayTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4' as const;

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

  async doGenerate({
    audio,
    mediaType,
    providerOptions,
    headers,
    abortSignal,
  }: Parameters<TranscriptionModelV4['doGenerate']>[0]): Promise<
    Awaited<ReturnType<TranscriptionModelV4['doGenerate']>>
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
          audio:
            audio instanceof Uint8Array
              ? convertUint8ArrayToBase64(audio)
              : audio,
          mediaType,
          ...(providerOptions && { providerOptions }),
        },
        successfulResponseHandler: createJsonResponseHandler(
          gatewayTranscriptionResponseSchema,
        ),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: z.any(),
          errorToMessage: data => data,
        }),
        ...(abortSignal && { abortSignal }),
        fetch: this.config.fetch,
      });

      return {
        text: responseBody.text,
        segments: responseBody.segments ?? [],
        language: responseBody.language ?? undefined,
        durationInSeconds: responseBody.durationInSeconds ?? undefined,
        warnings: (responseBody.warnings ?? []) as Array<SharedV4Warning>,
        providerMetadata:
          responseBody.providerMetadata as SharedV4ProviderMetadata,
        response: {
          timestamp: new Date(),
          modelId: this.modelId,
          headers: responseHeaders,
          body: rawValue,
        },
      };
    } catch (error) {
      throw await asGatewayError(
        error,
        await parseAuthMethod(resolvedHeaders ?? {}),
      );
    }
  }

  private getUrl() {
    return `${this.config.baseURL}/transcription-model`;
  }

  private getModelConfigHeaders() {
    return {
      'ai-transcription-model-specification-version': '4',
      'ai-model-id': this.modelId,
    };
  }
}

const providerMetadataEntrySchema = z.object({}).catchall(z.unknown());

const gatewayTranscriptionWarningSchema = z.discriminatedUnion('type', [
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

const gatewayTranscriptionResponseSchema = z.object({
  text: z.string(),
  segments: z
    .array(
      z.object({
        text: z.string(),
        startSecond: z.number(),
        endSecond: z.number(),
      }),
    )
    .optional(),
  language: z.string().nullish(),
  durationInSeconds: z.number().nullish(),
  warnings: z.array(gatewayTranscriptionWarningSchema).optional(),
  providerMetadata: z
    .record(z.string(), providerMetadataEntrySchema)
    .optional(),
});
