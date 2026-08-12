import type { ImageModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  convertImageModelFileToDataUri,
  createBinaryResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  createStatusCodeErrorResponseHandler,
  getFromApi,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type Resolvable,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { FalImageModelId, FalImageSize } from './fal-image-settings';
import { falImageModelOptionsSchema } from './fal-image-model-options';

interface FalImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class FalImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxImagesPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: FalImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: FalImageModelId;
    config: FalImageModelConfig;
  }) {
    return new FalImageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: FalImageModelId,
    private readonly config: FalImageModelConfig,
  ) {}

  private async getArgs({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    providerOptions,
    files,
    mask,
  }: Parameters<ImageModelV4['doGenerate']>[0]) {
    const warnings: Array<SharedV4Warning> = [];

    let imageSize: FalImageSize | undefined;
    if (size) {
      const [width, height] = size.split('x').map(Number);
      imageSize = { width, height };
    } else if (aspectRatio) {
      imageSize = convertAspectRatioToSize(aspectRatio);
    }

    const falOptions = await parseProviderOptions({
      provider: 'fal',
      providerOptions,
      schema: falImageModelOptionsSchema,
    });

    const requestBody: Record<string, unknown> = {
      prompt,
      seed,
      image_size: imageSize,
      num_images: n,
    };

    // Handle image editing: convert files to image_url or image_urls
    if (files != null && files.length > 0) {
      const useMultipleImages = falOptions?.useMultipleImages === true;

      if (useMultipleImages) {
        // Use image_urls array for models that support multiple images (e.g., flux-2/edit)
        requestBody.image_urls = files.map(file =>
          convertImageModelFileToDataUri(file),
        );
      } else {
        // Use single image_url for standard image editing models
        requestBody.image_url = convertImageModelFileToDataUri(files[0]);

        if (files.length > 1) {
          warnings.push({
            type: 'other',
            message:
              'Multiple input images provided but useMultipleImages is not enabled. ' +
              'Only the first image will be used. Set providerOptions.fal.useMultipleImages ' +
              'to true for models that support multiple images (e.g., fal-ai/flux-2/edit).',
          });
        }
      }
    }

    // Handle mask for inpainting
    if (mask != null) {
      requestBody.mask_url = convertImageModelFileToDataUri(mask);
    }

    if (falOptions) {
      const deprecatedKeys =
        '__deprecatedKeys' in falOptions
          ? (falOptions.__deprecatedKeys as string[])
          : undefined;

      if (deprecatedKeys && deprecatedKeys.length > 0) {
        warnings.push({
          type: 'other',
          message: `The following provider options use deprecated snake_case and will be removed in @ai-sdk/fal v2.0. Please use camelCase instead: ${deprecatedKeys
            .map(key => {
              const camelCase = key.replace(/_([a-z])/g, (_, letter) =>
                letter.toUpperCase(),
              );
              return `'${key}' (use '${camelCase}')`;
            })
            .join(', ')}`,
        });
      }

      const fieldMapping: Record<string, string> = {
        imageUrl: 'image_url',
        maskUrl: 'mask_url',
        guidanceScale: 'guidance_scale',
        numInferenceSteps: 'num_inference_steps',
        enableSafetyChecker: 'enable_safety_checker',
        outputFormat: 'output_format',
        syncMode: 'sync_mode',
        safetyTolerance: 'safety_tolerance',
      };

      for (const [key, value] of Object.entries(falOptions)) {
        if (key === '__deprecatedKeys') continue;
        if (key === 'useMultipleImages') continue; // Don't send to API
        const apiKey = fieldMapping[key] ?? key;

        if (value !== undefined) {
          requestBody[apiKey] = value;
        }
      }
    }

    return { requestBody, warnings } as const;
  }

  async doGenerate(
    options: Parameters<ImageModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<ImageModelV4['doGenerate']>>> {
    const { requestBody, warnings } = await this.getArgs(options);

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { value, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/${this.modelId}`,
      headers: combineHeaders(
        this.config.headers ? await resolve(this.config.headers) : undefined,
        options.headers,
      ),
      body: requestBody,
      failedResponseHandler: falFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        falImageResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const {
      images: targetImages,
      // prompt is just passed through and not a revised prompt per image
      prompt: _prompt,
      // NSFW information is normalized merged into `providerMetadata.fal.images`
      has_nsfw_concepts,
      nsfw_content_detected,
      // pass through other properties to providerMetadata
      ...responseMetaData
    } = value;

    // download the images:
    const downloadedImages = await Promise.all(
      targetImages.map(image =>
        this.downloadImage(image.url, options.abortSignal),
      ),
    );

    return {
      images: downloadedImages,
      warnings,
      response: {
        modelId: this.modelId,
        timestamp: currentDate,
        headers: responseHeaders,
      },
      providerMetadata: {
        fal: {
          images: targetImages.map((image, index) => {
            const {
              url: _url,
              content_type: contentType,
              file_name: fileName,
              file_data: fileData,
              file_size: fileSize,
              ...imageMetaData
            } = image;

            const nsfw =
              has_nsfw_concepts?.[index] ?? nsfw_content_detected?.[index];

            return {
              ...imageMetaData,
              ...removeOnlyUndefined({
                contentType,
                fileName,
                fileData,
                fileSize,
                nsfw,
              }),
            };
          }),
          ...responseMetaData,
        },
      },
    };
  }

  private async downloadImage(
    url: string,
    abortSignal: AbortSignal | undefined,
  ): Promise<Uint8Array> {
    const { value: response } = await getFromApi({
      url,
      // No specific headers should be needed for this request as it's a
      // generated image provided by fal.ai.
      abortSignal,
      failedResponseHandler: createStatusCodeErrorResponseHandler(),
      successfulResponseHandler: createBinaryResponseHandler(),
      fetch: this.config.fetch,
    });
    return response;
  }
}

function removeOnlyUndefined<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/**
 * Converts an aspect ratio to an image size compatible with fal.ai APIs.
 * @param aspectRatio - The aspect ratio to convert.
 * @returns The image size.
 */
function convertAspectRatioToSize(
  aspectRatio: `${number}:${number}`,
): FalImageSize | undefined {
  switch (aspectRatio) {
    case '1:1':
      return 'square_hd';
    case '16:9':
      return 'landscape_16_9';
    case '9:16':
      return 'portrait_16_9';
    case '4:3':
      return 'landscape_4_3';
    case '3:4':
      return 'portrait_4_3';
    case '16:10':
      return { width: 1280, height: 800 };
    case '10:16':
      return { width: 800, height: 1280 };
    case '21:9':
      return { width: 2560, height: 1080 };
    case '9:21':
      return { width: 1080, height: 2560 };
  }
  return undefined;
}

// Validation error has a particular payload to inform the exact property that is invalid
const falValidationErrorSchema = z.object({
  detail: z.array(
    z.object({
      loc: z.array(z.string()),
      msg: z.string(),
      type: z.string(),
    }),
  ),
});

type ValidationError = z.infer<typeof falValidationErrorSchema>;

// Other errors have a message property
const falHttpErrorSchema = z.object({
  message: z.string(),
});

const falErrorSchema = z.union([falValidationErrorSchema, falHttpErrorSchema]);

const falImageSchema = z.object({
  url: z.string(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  // e.g. https://fal.ai/models/fal-ai/fashn/tryon/v1.6/api#schema-output
  content_type: z.string().nullish(),
  // e.g. https://fal.ai/models/fal-ai/flowedit/api#schema-output
  file_name: z.string().nullish(),
  file_data: z.string().optional(),
  file_size: z.number().nullish(),
});

// https://fal.ai/models/fal-ai/lora/api#type-File
const loraFileSchema = z.object({
  url: z.string(),
  content_type: z.string().optional(),
  file_name: z.string().nullable().optional(),
  file_data: z.string().optional(),
  file_size: z.number().nullable().optional(),
});

const commonResponseSchema = z.object({
  timings: z
    .object({
      inference: z.number().optional(),
    })
    .optional(),
  seed: z.number().optional(),
  has_nsfw_concepts: z.array(z.boolean()).optional(),
  prompt: z.string().optional(),
  // https://fal.ai/models/fal-ai/lcm/api#schema-output
  nsfw_content_detected: z.array(z.boolean()).optional(),
  num_inference_steps: z.number().optional(),
  // https://fal.ai/models/fal-ai/lora/api#schema-output
  debug_latents: loraFileSchema.optional(),
  debug_per_pass_latents: loraFileSchema.optional(),
});

// Most FAL image models respond with an array of images, but some have a response
// with a single image, e.g. https://fal.ai/models/easel-ai/easel-avatar/api#schema-output
const base = z.looseObject(commonResponseSchema.shape);
const falImageResponseSchema = z
  .union([
    base.extend({ images: z.array(falImageSchema) }),
    base.extend({ image: falImageSchema }),
  ])
  .transform(v => ('images' in v ? v : { ...v, images: [v.image] }))
  .pipe(base.extend({ images: z.array(falImageSchema) }));

function isValidationError(error: unknown): error is ValidationError {
  return falValidationErrorSchema.safeParse(error).success;
}

const falFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: falErrorSchema,
  errorToMessage: error => {
    if (isValidationError(error)) {
      return error.detail
        .map(detail => `${detail.loc.join('.')}: ${detail.msg}`)
        .join('\n');
    }
    return error.message ?? 'Unknown fal error';
  },
});
