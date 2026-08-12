import {
  InvalidResponseDataError,
  type ImageModelV4,
  type ImageModelV4File,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createBinaryResponseHandler,
  createJsonResponseHandler,
  createJsonErrorResponseHandler,
  createStatusCodeErrorResponseHandler,
  delay,
  getFromApi,
  postJsonToApi,
  lazySchema,
  parseProviderOptions,
  zodSchema,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { lumaImageModelOptionsSchema } from './luma-image-model-options';
import type { LumaReferenceType } from './luma-image-settings';
import { z } from 'zod/v4';

const DEFAULT_POLL_INTERVAL_MILLIS = 500;
const DEFAULT_MAX_POLL_ATTEMPTS = 60000 / DEFAULT_POLL_INTERVAL_MILLIS;

interface LumaImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class LumaImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxImagesPerCall = 1;
  readonly pollIntervalMillis = DEFAULT_POLL_INTERVAL_MILLIS;
  readonly maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS;

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: LumaImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: LumaImageModelConfig;
  }) {
    return new LumaImageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: string,
    private readonly config: LumaImageModelConfig,
  ) {}

  async doGenerate({
    prompt,
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

    if (seed != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'seed',
        details: 'This model does not support the `seed` option.',
      });
    }

    if (size != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'size',
        details:
          'This model does not support the `size` option. Use `aspectRatio` instead.',
      });
    }

    // Parse and validate provider options
    const lumaOptions = await parseProviderOptions({
      provider: 'luma',
      providerOptions,
      schema: lumaImageModelOptionsSchema,
    });

    // Extract non-request options
    const {
      pollIntervalMillis,
      maxPollAttempts,
      referenceType,
      images: imageConfigs,
      ...providerRequestOptions
    } = lumaOptions ?? {};

    // Handle image editing via files with reference type support
    const editingOptions = this.getEditingOptions(
      files,
      mask,
      referenceType ?? undefined,
      imageConfigs ?? [],
    );

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const fullHeaders = combineHeaders(this.config.headers?.(), headers);
    const { value: generationResponse, responseHeaders } = await postJsonToApi({
      url: this.getLumaGenerationsUrl(),
      headers: fullHeaders,
      body: {
        prompt,
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        model: this.modelId,
        ...editingOptions,
        ...providerRequestOptions,
      },
      abortSignal,
      fetch: this.config.fetch,
      failedResponseHandler: this.createLumaErrorHandler(),
      successfulResponseHandler: createJsonResponseHandler(
        lumaGenerationResponseSchema,
      ),
    });

    const imageUrl = await this.pollForImageUrl(
      generationResponse.id,
      fullHeaders,
      abortSignal,
      {
        pollIntervalMillis: pollIntervalMillis ?? undefined,
        maxPollAttempts: maxPollAttempts ?? undefined,
      },
    );

    const downloadedImage = await this.downloadImage(imageUrl, abortSignal);

    return {
      images: [downloadedImage],
      warnings,
      response: {
        modelId: this.modelId,
        timestamp: currentDate,
        headers: responseHeaders,
      },
    };
  }

  private async pollForImageUrl(
    generationId: string,
    headers: Record<string, string | undefined>,
    abortSignal: AbortSignal | undefined,
    pollSettings?: { pollIntervalMillis?: number; maxPollAttempts?: number },
  ): Promise<string> {
    const url = this.getLumaGenerationsUrl(generationId);
    const maxPollAttempts =
      pollSettings?.maxPollAttempts ?? this.maxPollAttempts;
    const pollIntervalMillis =
      pollSettings?.pollIntervalMillis ?? this.pollIntervalMillis;

    for (let i = 0; i < maxPollAttempts; i++) {
      const { value: statusResponse } = await getFromApi({
        url,
        headers,
        abortSignal,
        fetch: this.config.fetch,
        failedResponseHandler: this.createLumaErrorHandler(),
        successfulResponseHandler: createJsonResponseHandler(
          lumaGenerationResponseSchema,
        ),
      });

      switch (statusResponse.state) {
        case 'completed':
          if (!statusResponse.assets?.image) {
            throw new InvalidResponseDataError({
              data: statusResponse,
              message: `Image generation completed but no image was found.`,
            });
          }
          return statusResponse.assets.image;
        case 'failed':
          throw new InvalidResponseDataError({
            data: statusResponse,
            message: `Image generation failed.`,
          });
      }
      await delay(pollIntervalMillis);
    }

    throw new Error(
      `Image generation timed out after ${this.maxPollAttempts} attempts.`,
    );
  }

  private createLumaErrorHandler() {
    return createJsonErrorResponseHandler({
      errorSchema: lumaErrorSchema,
      errorToMessage: (error: LumaErrorData) =>
        error.detail[0].msg ?? 'Unknown error',
    });
  }

  private getEditingOptions(
    files: ImageModelV4File[] | undefined,
    mask: ImageModelV4File | undefined,
    referenceType: LumaReferenceType = 'image',
    imageConfigs: Array<{ weight?: number | null; id?: string | null }> = [],
  ): Record<string, unknown> {
    const options: Record<string, unknown> = {};

    // Luma does not support mask-based inpainting
    if (mask != null) {
      throw new Error(
        'Luma AI does not support mask-based image editing. ' +
          'Use the prompt to describe the changes you want to make, along with ' +
          '`prompt.images` containing the source image URL.',
      );
    }

    if (files == null || files.length === 0) {
      return options;
    }

    // Validate all files are URL-based
    for (const file of files) {
      if (file.type !== 'url') {
        throw new Error(
          'Luma AI only supports URL-based images. ' +
            'Please provide image URLs using `prompt.images` with publicly accessible URLs. ' +
            'Base64 and Uint8Array data are not supported.',
        );
      }
    }

    // Default weights per reference type
    const defaultWeights: Record<LumaReferenceType, number> = {
      image: 0.85,
      style: 0.8,
      character: 1.0, // Not used, but defined for completeness
      modify_image: 1.0,
    };

    switch (referenceType) {
      case 'image': {
        // Supports up to 4 images
        if (files.length > 4) {
          throw new Error(
            'Luma AI image supports up to 4 reference images. ' +
              `You provided ${files.length} images.`,
          );
        }
        options.image = files.map((file, index) => ({
          url: (file as { type: 'url'; url: string }).url,
          weight: imageConfigs[index]?.weight ?? defaultWeights.image,
        }));
        break;
      }

      case 'style': {
        // Style ref accepts an array but typically uses one style image
        options.style = files.map((file, index) => ({
          url: (file as { type: 'url'; url: string }).url,
          weight: imageConfigs[index]?.weight ?? defaultWeights.style,
        }));
        break;
      }

      case 'character': {
        // Group images by identity id
        const identities: Record<string, string[]> = {};
        for (let i = 0; i < files.length; i++) {
          const file = files[i] as { type: 'url'; url: string };
          const identityId = imageConfigs[i]?.id ?? 'identity0';
          if (!identities[identityId]) {
            identities[identityId] = [];
          }
          identities[identityId].push(file.url);
        }

        // Validate each identity has at most 4 images
        for (const [identityId, images] of Object.entries(identities)) {
          if (images.length > 4) {
            throw new Error(
              `Luma AI character supports up to 4 images per identity. ` +
                `Identity '${identityId}' has ${images.length} images.`,
            );
          }
        }

        options.character = Object.fromEntries(
          Object.entries(identities).map(([id, images]) => [id, { images }]),
        );
        break;
      }

      case 'modify_image': {
        // Only supports a single image
        if (files.length > 1) {
          throw new Error(
            'Luma AI modify_image only supports a single input image. ' +
              `You provided ${files.length} images.`,
          );
        }
        options.modify_image = {
          url: (files[0] as { type: 'url'; url: string }).url,
          weight: imageConfigs[0]?.weight ?? defaultWeights.modify_image,
        };
        break;
      }
    }

    return options;
  }

  private getLumaGenerationsUrl(generationId?: string) {
    return `${this.config.baseURL}/dream-machine/v1/generations/${
      generationId ?? 'image'
    }`;
  }

  private async downloadImage(
    url: string,
    abortSignal: AbortSignal | undefined,
  ): Promise<Uint8Array> {
    const { value: response } = await getFromApi({
      url,
      // No specific headers should be needed for this request as it's a
      // generated image provided by Luma.
      abortSignal,
      failedResponseHandler: createStatusCodeErrorResponseHandler(),
      successfulResponseHandler: createBinaryResponseHandler(),
      fetch: this.config.fetch,
    });
    return response;
  }
}

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const lumaGenerationResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      id: z.string(),
      state: z.enum(['queued', 'dreaming', 'completed', 'failed']),
      failure_reason: z.string().nullish(),
      assets: z
        .object({
          image: z.string(), // URL of the generated image
        })
        .nullish(),
    }),
  ),
);

const lumaErrorSchema = z.object({
  detail: z.array(
    z.object({
      type: z.string(),
      loc: z.array(z.string()),
      msg: z.string(),
      input: z.string(),
      ctx: z
        .object({
          expected: z.string(),
        })
        .nullish(),
    }),
  ),
});

export type LumaErrorData = z.infer<typeof lumaErrorSchema>;

/**
 * Provider options schema for Luma image generation.
 *
 * @see https://docs.lumalabs.ai/docs/image-generation
 */
