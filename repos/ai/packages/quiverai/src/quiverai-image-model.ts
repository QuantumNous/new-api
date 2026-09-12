import {
  InvalidArgumentError,
  type ImageModelV4,
  type ImageModelV4CallOptions,
  type ImageModelV4File,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertUint8ArrayToBase64,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import {
  quiveraiImageModelOptionsSchema,
  type QuiverAIImageModelOptions,
} from './quiverai-image-model-options';
import type {
  QuiverAIImageModelId,
  QuiverAIOperation,
} from './quiverai-image-settings';

interface QuiverAIImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class QuiverAIImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxImagesPerCall = 16;

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: QuiverAIImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: QuiverAIImageModelId;
    config: QuiverAIImageModelConfig;
  }) {
    return new QuiverAIImageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: QuiverAIImageModelId,
    private readonly config: QuiverAIImageModelConfig,
  ) {}

  async doGenerate({
    prompt,
    n,
    files,
    mask,
    size,
    aspectRatio,
    seed,
    providerOptions,
    headers,
    abortSignal,
  }: ImageModelV4CallOptions): Promise<
    Awaited<ReturnType<ImageModelV4['doGenerate']>>
  > {
    const quiveraiOptions = await parseProviderOptions({
      provider: 'quiverai',
      providerOptions,
      schema: quiveraiImageModelOptionsSchema,
    });

    const operation: QuiverAIOperation =
      quiveraiOptions?.operation ?? 'generate';

    const warnings = collectWarnings({ size, aspectRatio, seed, mask });

    const body = buildRequestBody({
      modelId: this.modelId,
      n,
      prompt,
      files,
      operation,
      options: quiveraiOptions ?? {},
    });

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const combinedHeaders = combineHeaders(this.config.headers?.(), headers);

    const { value: response, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}${getOperationPath(operation)}`,
      headers: combinedHeaders,
      body,
      failedResponseHandler: quiveraiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        svgGenerationResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    const encoder = new TextEncoder();
    const images = response.data.map(image => encoder.encode(image.svg));

    return {
      images,
      warnings,
      providerMetadata: {
        quiverai: {
          images: response.data.map((image, index) => ({
            index,
            mimeType: image.mime_type,
          })),
        },
      },
      response: {
        timestamp: response.created
          ? new Date(response.created * 1000)
          : currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
      ...(response.usage && {
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.total_tokens,
        },
      }),
    };
  }
}

function getOperationPath(operation: QuiverAIOperation) {
  return operation === 'generate'
    ? '/svgs/generations'
    : '/svgs/vectorizations';
}

function getGenerateReferenceLimit(modelId: string) {
  return modelId === 'arrow-1.1-max' ? 16 : 4;
}

function toQuiverAIImageReference(image: ImageModelV4File) {
  if (image.type === 'url') {
    return { url: image.url };
  }
  return {
    base64:
      typeof image.data === 'string'
        ? image.data
        : convertUint8ArrayToBase64(image.data),
  };
}

function buildRequestBody({
  modelId,
  n,
  prompt,
  files,
  operation,
  options,
}: {
  modelId: string;
  n: number;
  prompt: string | undefined;
  files: ImageModelV4File[] | undefined;
  operation: QuiverAIOperation;
  options: QuiverAIImageModelOptions;
}) {
  const sharedOptions = {
    temperature: options.temperature,
    top_p: options.topP,
    presence_penalty: options.presencePenalty,
    max_output_tokens: options.maxOutputTokens,
    stream: false as const,
  };

  if (operation === 'generate') {
    if (prompt == null || prompt.trim().length === 0) {
      throw new InvalidArgumentError({
        argument: 'prompt',
        message:
          'QuiverAI image generation requires a non-empty prompt for generateImage.',
      });
    }

    const references = files?.map(toQuiverAIImageReference);
    const maxReferences = getGenerateReferenceLimit(modelId);

    if (references != null && references.length > maxReferences) {
      throw new InvalidArgumentError({
        argument: 'files',
        message: `QuiverAI generate supports up to ${maxReferences} reference images for model "${modelId}".`,
      });
    }

    return {
      model: modelId,
      n,
      prompt,
      ...sharedOptions,
      instructions: options.instructions,
      references,
    };
  }

  if (files == null || files.length === 0) {
    throw new InvalidArgumentError({
      argument: 'files',
      message:
        'QuiverAI vectorize requires an input image. Pass an image in the generateImage prompt and set providerOptions.quiverai.operation to "vectorize".',
    });
  }

  if (files.length > 1) {
    throw new InvalidArgumentError({
      argument: 'files',
      message: 'QuiverAI vectorize accepts a single input image.',
    });
  }

  return {
    model: modelId,
    n,
    image: toQuiverAIImageReference(files[0]),
    ...sharedOptions,
    auto_crop: options.autoCrop,
    target_size: options.targetSize,
  };
}

function collectWarnings({
  size,
  aspectRatio,
  seed,
  mask,
}: {
  size: `${number}x${number}` | undefined;
  aspectRatio: `${number}:${number}` | undefined;
  seed: number | undefined;
  mask: ImageModelV4File | undefined;
}): SharedV4Warning[] {
  const warnings: SharedV4Warning[] = [];

  if (size != null) {
    warnings.push({
      type: 'unsupported',
      feature: 'size',
      details:
        'QuiverAI SVG generation does not support the `size` option. The setting was ignored.',
    });
  }

  if (aspectRatio != null) {
    warnings.push({
      type: 'unsupported',
      feature: 'aspectRatio',
      details:
        'QuiverAI SVG generation does not support the `aspectRatio` option. The setting was ignored.',
    });
  }

  if (seed != null) {
    warnings.push({
      type: 'unsupported',
      feature: 'seed',
      details:
        'QuiverAI SVG generation does not support the `seed` option. The setting was ignored.',
    });
  }

  if (mask != null) {
    warnings.push({
      type: 'unsupported',
      feature: 'mask',
      details:
        'QuiverAI SVG generation does not support masks. The mask was ignored.',
    });
  }

  return warnings;
}

// Limited schemas focused on what is needed for the implementation.
// This approach limits breakages when the API changes and keeps the
// response handler efficient.
const svgUsageSchema = z.object({
  total_tokens: z.number().int().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
});

const svgDocumentSchema = z.object({
  svg: z.string().min(1),
  mime_type: z.literal('image/svg+xml'),
});

const svgGenerationResponseSchema = z.object({
  id: z.string().min(1),
  created: z.number().int().nonnegative(),
  data: z.array(svgDocumentSchema).min(1),
  usage: svgUsageSchema.nullish(),
});

const quiveraiErrorSchema = z.object({
  status: z.number().int(),
  code: z.string().min(1),
  message: z.string().min(1),
  request_id: z.string().min(1),
});

export const quiveraiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: quiveraiErrorSchema,
  errorToMessage: error => error.message,
  isRetryable: response => response.status === 429 || response.status >= 500,
});
