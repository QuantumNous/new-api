import type { ImageModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  convertImageModelFileToDataUri,
  createBinaryResponseHandler,
  createJsonResponseHandler,
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
import { replicateFailedResponseHandler } from './replicate-error';
import { replicateImageModelOptionsSchema } from './replicate-image-model-options';
import type { ReplicateImageModelId } from './replicate-image-settings';

interface ReplicateImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

// Flux-2 models support up to 8 input images with input_image, input_image_2, etc.
const FLUX_2_MODEL_PATTERN = /^black-forest-labs\/flux-2-/;
const MAX_FLUX_2_INPUT_IMAGES = 8;

export class ReplicateImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';

  get maxImagesPerCall(): number {
    // Flux-2 models support up to 8 input images
    return this.isFlux2Model ? MAX_FLUX_2_INPUT_IMAGES : 1;
  }

  get provider(): string {
    return this.config.provider;
  }

  private get isFlux2Model(): boolean {
    return FLUX_2_MODEL_PATTERN.test(this.modelId);
  }

  static [WORKFLOW_SERIALIZE](model: ReplicateImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: ReplicateImageModelId;
    config: ReplicateImageModelConfig;
  }) {
    return new ReplicateImageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: ReplicateImageModelId,
    private readonly config: ReplicateImageModelConfig,
  ) {}

  async doGenerate({
    prompt,
    n,
    aspectRatio,
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

    const [modelId, version] = this.modelId.split(':');

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();

    // Parse provider options
    const replicateOptions = await parseProviderOptions({
      provider: 'replicate',
      providerOptions,
      schema: replicateImageModelOptionsSchema,
    });

    // Handle image input from files
    let imageInputs: Record<string, string> = {};
    if (files != null && files.length > 0) {
      if (this.isFlux2Model) {
        // Flux-2 models use input_image, input_image_2, input_image_3, etc.
        for (
          let i = 0;
          i < Math.min(files.length, MAX_FLUX_2_INPUT_IMAGES);
          i++
        ) {
          const key = i === 0 ? 'input_image' : `input_image_${i + 1}`;
          imageInputs[key] = convertImageModelFileToDataUri(files[i]);
        }
        if (files.length > MAX_FLUX_2_INPUT_IMAGES) {
          warnings.push({
            type: 'other',
            message: `Flux-2 models support up to ${MAX_FLUX_2_INPUT_IMAGES} input images. Additional images are ignored.`,
          });
        }
      } else {
        // Other models use single 'image' parameter
        imageInputs = { image: convertImageModelFileToDataUri(files[0]) };
        if (files.length > 1) {
          warnings.push({
            type: 'other',
            message:
              'This Replicate model only supports a single input image. Additional images are ignored.',
          });
        }
      }
    }

    // Handle mask input (not supported by Flux-2 models)
    let maskInput: string | undefined;
    if (mask != null) {
      if (this.isFlux2Model) {
        warnings.push({
          type: 'other',
          message:
            'Flux-2 models do not support mask input. The mask will be ignored.',
        });
      } else {
        maskInput = convertImageModelFileToDataUri(mask);
      }
    }

    // Extract maxWaitTimeInSeconds from provider options and prepare the rest for the request body
    const { maxWaitTimeInSeconds, ...inputOptions } = replicateOptions ?? {};

    // Build the prefer header based on maxWaitTimeInSeconds:
    // - undefined/null: use default sync wait (prefer: wait)
    // - positive number: use custom wait duration (prefer: wait=N)
    const preferHeader: Record<string, string> =
      maxWaitTimeInSeconds != null
        ? { prefer: `wait=${maxWaitTimeInSeconds}` }
        : { prefer: 'wait' };

    const {
      value: { output },
      responseHeaders,
    } = await postJsonToApi({
      url:
        // different endpoints for versioned vs unversioned models:
        version != null
          ? `${this.config.baseURL}/predictions`
          : `${this.config.baseURL}/models/${modelId}/predictions`,

      headers: combineHeaders(
        this.config.headers ? await resolve(this.config.headers) : undefined,
        headers,
        preferHeader,
      ),

      body: {
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          size,
          seed,
          num_outputs: n,
          ...imageInputs,
          ...(maskInput != null ? { mask: maskInput } : {}),
          ...inputOptions,
        },
        // for versioned models, include the version in the body:
        ...(version != null ? { version } : {}),
      },

      successfulResponseHandler: createJsonResponseHandler(
        replicateImageResponseSchema,
      ),
      failedResponseHandler: replicateFailedResponseHandler,
      abortSignal,
      fetch: this.config.fetch,
    });

    // download the images:
    const outputArray = Array.isArray(output) ? output : [output];
    const images = await Promise.all(
      outputArray.map(async url => {
        const { value: image } = await getFromApi({
          url,
          successfulResponseHandler: createBinaryResponseHandler(),
          failedResponseHandler: replicateFailedResponseHandler,
          abortSignal,
          fetch: this.config.fetch,
        });
        return image;
      }),
    );

    return {
      images,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }
}

const replicateImageResponseSchema = z.object({
  output: z.union([z.array(z.string()), z.string()]),
});
