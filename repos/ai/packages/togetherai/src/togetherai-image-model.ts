import type { ImageModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  convertImageModelFileToDataUri,
  createJsonResponseHandler,
  createJsonErrorResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { togetheraiImageModelOptionsSchema } from './togetherai-image-model-options';
import type { TogetherAIImageModelId } from './togetherai-image-settings';
import { z } from 'zod/v4';

interface TogetherAIImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class TogetherAIImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxImagesPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: TogetherAIImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: TogetherAIImageModelId;
    config: TogetherAIImageModelConfig;
  }) {
    return new TogetherAIImageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: TogetherAIImageModelId,
    private config: TogetherAIImageModelConfig,
  ) {}

  async doGenerate({
    prompt,
    n,
    size,
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

    if (mask != null) {
      throw new Error(
        'Together AI does not support mask-based image editing. ' +
          'Use FLUX Kontext models (e.g., black-forest-labs/FLUX.1-kontext-pro) ' +
          'with a reference image and descriptive prompt instead.',
      );
    }

    if (size != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'aspectRatio',
        details:
          'This model does not support the `aspectRatio` option. Use `size` instead.',
      });
    }

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();

    const togetheraiOptions = await parseProviderOptions({
      provider: 'togetherai',
      providerOptions,
      schema: togetheraiImageModelOptionsSchema,
    });

    // Handle image input from files
    let imageUrl: string | undefined;
    if (files != null && files.length > 0) {
      imageUrl = convertImageModelFileToDataUri(files[0]);

      if (files.length > 1) {
        warnings.push({
          type: 'other',
          message:
            'Together AI only supports a single input image. Additional images are ignored.',
        });
      }
    }

    const splitSize = size?.split('x');
    // https://docs.together.ai/reference/post_images-generations
    const { value: response, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/images/generations`,
      headers: combineHeaders(this.config.headers?.(), headers),
      body: {
        model: this.modelId,
        prompt,
        ...(seed != null ? { seed } : {}),
        ...(n > 1 ? { n } : {}),
        ...(splitSize && {
          width: parseInt(splitSize[0]),
          height: parseInt(splitSize[1]),
        }),
        ...(imageUrl != null ? { image_url: imageUrl } : {}),
        response_format: 'base64',
        ...(togetheraiOptions ?? {}),
      },
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: togetheraiErrorSchema,
        errorToMessage: data => data.error.message,
      }),
      successfulResponseHandler: createJsonResponseHandler(
        togetheraiImageResponseSchema,
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
}

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const togetheraiImageResponseSchema = z.object({
  data: z.array(
    z.object({
      b64_json: z.string(),
    }),
  ),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const togetheraiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});
