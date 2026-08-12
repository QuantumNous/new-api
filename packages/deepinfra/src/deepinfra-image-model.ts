import type {
  ImageModelV4,
  ImageModelV4File,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  convertToFormData,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  downloadBlob,
  postFormDataToApi,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import type { DeepInfraImageModelId } from './deepinfra-image-settings';
import { z } from 'zod/v4';

interface DeepInfraImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class DeepInfraImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxImagesPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: DeepInfraImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: DeepInfraImageModelId;
    config: DeepInfraImageModelConfig;
  }) {
    return new DeepInfraImageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: DeepInfraImageModelId,
    private config: DeepInfraImageModelConfig,
  ) {}

  async doGenerate({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    providerOptions,
    headers,
    abortSignal,
    files,
    mask,
  }: Parameters<ImageModelV4['doGenerate']>[0]): Promise<
    Awaited<ReturnType<ImageModelV4['doGenerate']>>
  > {
    const warnings: Array<SharedV4Warning> = [];
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();

    // Image editing mode - use OpenAI-compatible /images/edits endpoint
    if (files != null && files.length > 0) {
      const { value: response, responseHeaders } = await postFormDataToApi({
        url: this.getEditUrl(),
        headers: combineHeaders(this.config.headers?.(), headers),
        formData: convertToFormData<DeepInfraFormDataInput>(
          {
            model: this.modelId,
            prompt,
            image: await Promise.all(files.map(file => fileToBlob(file))),
            mask: mask != null ? await fileToBlob(mask) : undefined,
            n,
            size,
            ...(providerOptions.deepinfra ?? {}),
          },
          { useArrayBrackets: false },
        ),
        failedResponseHandler: createJsonErrorResponseHandler({
          errorSchema: deepInfraEditErrorSchema,
          errorToMessage: error => error.error?.message ?? 'Unknown error',
        }),
        successfulResponseHandler: createJsonResponseHandler(
          deepInfraEditResponseSchema,
        ),
        abortSignal,
        fetch: this.config.fetch,
      });

      return {
        images: response.data.map(item => item.b64_json),
        warnings,
        response: {
          timestamp: currentDate,
          modelId: this.modelId,
          headers: responseHeaders,
        },
      };
    }

    // Standard image generation mode
    // Some deepinfra models support size while others support aspect ratio.
    // Allow passing either and leave it up to the server to validate.
    const splitSize = size?.split('x');
    const { value: response, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/${this.modelId}`,
      headers: combineHeaders(this.config.headers?.(), headers),
      body: {
        prompt,
        num_images: n,
        ...(aspectRatio && { aspect_ratio: aspectRatio }),
        ...(splitSize && { width: splitSize[0], height: splitSize[1] }),
        ...(seed != null && { seed }),
        ...(providerOptions.deepinfra ?? {}),
      },
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: deepInfraErrorSchema,
        errorToMessage: error => error.detail.error,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        deepInfraImageResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      images: response.images.map(image =>
        image.replace(/^data:image\/\w+;base64,/, ''),
      ),
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }

  private getEditUrl(): string {
    // Use OpenAI-compatible endpoint for image editing
    // baseURL is typically https://api.deepinfra.com/v1/inference
    // We need to use https://api.deepinfra.com/v1/openai/images/edits
    const baseUrl = this.config.baseURL.replace('/inference', '/openai');
    return `${baseUrl}/images/edits`;
  }
}

export const deepInfraErrorSchema = z.object({
  detail: z.object({
    error: z.string(),
  }),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const deepInfraImageResponseSchema = z.object({
  images: z.array(z.string()),
});

// Schema for OpenAI-compatible image edit endpoint errors
export const deepInfraEditErrorSchema = z.object({
  error: z
    .object({
      message: z.string(),
    })
    .optional(),
});

// Schema for OpenAI-compatible image edit endpoint response
export const deepInfraEditResponseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string() })),
});

type DeepInfraFormDataInput = {
  model: string;
  prompt: string | undefined;
  image: Blob | Blob[];
  mask?: Blob;
  n: number;
  size: `${number}x${number}` | undefined;
  [key: string]: unknown;
};

async function fileToBlob(file: ImageModelV4File): Promise<Blob> {
  if (file.type === 'url') {
    return downloadBlob(file.url);
  }

  const data =
    file.data instanceof Uint8Array
      ? file.data
      : convertBase64ToUint8Array(file.data);

  return new Blob([data as BlobPart], { type: file.mediaType });
}
