import type {
  ImageModelV4,
  LanguageModelV4Prompt,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertToBase64,
  createJsonResponseHandler,
  generateId as defaultGenerateId,
  lazySchema,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  zodSchema,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { googleFailedResponseHandler } from './google-error';
import { googleImageModelOptionsSchema } from './google-image-model-options';
import type {
  GoogleImageModelId,
  GoogleImageSettings,
} from './google-image-settings';
import { GoogleLanguageModel } from './google-language-model';
import type { GoogleLanguageModelOptions } from './google-language-model-options';

interface GoogleImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  generateId?: () => string;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class GoogleImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';

  static [WORKFLOW_SERIALIZE](model: GoogleImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: GoogleImageModelConfig;
  }) {
    return new GoogleImageModel(options.modelId, {}, options.config);
  }

  get maxImagesPerCall(): number {
    if (this.settings.maxImagesPerCall != null) {
      return this.settings.maxImagesPerCall;
    }
    // https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-image
    if (isGeminiModel(this.modelId)) {
      return 10;
    }
    // https://ai.google.dev/gemini-api/docs/imagen#imagen-model
    return 4;
  }

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: GoogleImageModelId,
    private readonly settings: GoogleImageSettings,
    private readonly config: GoogleImageModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<ImageModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<ImageModelV4['doGenerate']>>> {
    // Gemini image models use the language model API internally
    if (isGeminiModel(this.modelId)) {
      return this.doGenerateGemini(options);
    }
    return this.doGenerateImagen(options);
  }

  private async doGenerateImagen(
    options: Parameters<ImageModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<ImageModelV4['doGenerate']>>> {
    const {
      prompt,
      n = 1,
      size,
      aspectRatio = '1:1',
      seed,
      providerOptions,
      headers,
      abortSignal,
      files,
      mask,
    } = options;
    const warnings: Array<SharedV4Warning> = [];

    // Imagen API endpoints do not support image editing
    if (files != null && files.length > 0) {
      throw new Error(
        'Google Gemini API does not support image editing with Imagen models. ' +
          'Use Google Vertex AI (@ai-sdk/google-vertex) for image editing capabilities.',
      );
    }

    if (mask != null) {
      throw new Error(
        'Google Gemini API does not support image editing with masks. ' +
          'Use Google Vertex AI (@ai-sdk/google-vertex) for image editing capabilities.',
      );
    }

    if (size != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'size',
        details:
          'This model does not support the `size` option. Use `aspectRatio` instead.',
      });
    }

    if (seed != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'seed',
        details:
          'This model does not support the `seed` option through this provider.',
      });
    }

    const googleOptions = await parseProviderOptions({
      provider: 'google',
      providerOptions,
      schema: googleImageModelOptionsSchema,
    });

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();

    const parameters: Record<string, unknown> = {
      sampleCount: n,
    };

    if (aspectRatio != null) {
      parameters.aspectRatio = aspectRatio;
    }

    if (googleOptions) {
      const { googleSearch: imagenGoogleSearch, ...imagenOptions } =
        googleOptions;
      if (imagenGoogleSearch != null) {
        warnings.push({
          type: 'unsupported',
          feature: 'googleSearch',
          details:
            'Google Search grounding is only supported on Gemini image models.',
        });
      }
      Object.assign(parameters, imagenOptions);
    }

    const body = {
      instances: [{ prompt }],
      parameters,
    };

    const { responseHeaders, value: response } = await postJsonToApi<{
      predictions: Array<{ bytesBase64Encoded: string }>;
    }>({
      url: `${this.config.baseURL}/models/${this.modelId}:predict`,
      headers: combineHeaders(
        this.config.headers ? await resolve(this.config.headers) : undefined,
        headers,
      ),
      body,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        googleImageResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });
    return {
      images: response.predictions.map(
        (p: { bytesBase64Encoded: string }) => p.bytesBase64Encoded,
      ),
      warnings,
      providerMetadata: {
        google: {
          images: response.predictions.map(() => ({
            // Add any prediction-specific metadata here
          })),
        },
      },
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }

  private async doGenerateGemini(
    options: Parameters<ImageModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<ImageModelV4['doGenerate']>>> {
    const {
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
    } = options;
    const warnings: Array<SharedV4Warning> = [];

    // Gemini does not support mask-based inpainting
    if (mask != null) {
      throw new Error(
        'Gemini image models do not support mask-based image editing.',
      );
    }

    // Gemini does not support generating multiple images per call via n parameter
    if (n != null && n > 1) {
      throw new Error(
        'Gemini image models do not support generating a set number of images per call. Use n=1 or omit the n parameter.',
      );
    }

    if (size != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'size',
        details:
          'This model does not support the `size` option. Use `aspectRatio` instead.',
      });
    }

    const userContent: Array<
      | { type: 'text'; text: string }
      | {
          type: 'file';
          data:
            | { type: 'data'; data: string | Uint8Array }
            | { type: 'url'; url: URL };
          mediaType: string;
        }
    > = [];

    if (prompt != null) {
      userContent.push({ type: 'text', text: prompt });
    }

    if (files != null && files.length > 0) {
      for (const file of files) {
        if (file.type === 'url') {
          userContent.push({
            type: 'file',
            data: { type: 'url', url: new URL(file.url) },
            mediaType: 'image/*',
          });
        } else {
          userContent.push({
            type: 'file',
            data: {
              type: 'data',
              data:
                typeof file.data === 'string'
                  ? file.data
                  : new Uint8Array(file.data),
            },
            mediaType: file.mediaType,
          });
        }
      }
    }

    const languageModelPrompt: LanguageModelV4Prompt = [
      { role: 'user', content: userContent },
    ];

    // Parse image-model-specific provider options so we can map them onto
    // the underlying language-model call. `googleSearch` is the dedicated
    // escape hatch for grounding (generateImage has no `tools` parameter).
    const googleImageOptions = await parseProviderOptions({
      provider: 'google',
      providerOptions,
      schema: googleImageModelOptionsSchema,
    });

    const { googleSearch: _strippedGoogleSearch, ...passthroughGoogleOptions } =
      providerOptions?.google ?? {};

    // Instantiate language model
    const languageModel = new GoogleLanguageModel(this.modelId, {
      provider: this.config.provider,
      baseURL: this.config.baseURL,
      headers: this.config.headers ?? {},
      fetch: this.config.fetch,
      generateId: this.config.generateId ?? defaultGenerateId,
    });

    // Call language model with image-only response modality
    const result = await languageModel.doGenerate({
      prompt: languageModelPrompt,
      seed,
      providerOptions: {
        google: {
          responseModalities: ['IMAGE'],
          imageConfig: aspectRatio
            ? {
                aspectRatio: aspectRatio as NonNullable<
                  GoogleLanguageModelOptions['imageConfig']
                >['aspectRatio'],
              }
            : undefined,
          ...(passthroughGoogleOptions as Omit<
            GoogleLanguageModelOptions,
            'responseModalities' | 'imageConfig'
          >),
        } satisfies GoogleLanguageModelOptions,
      },
      tools:
        googleImageOptions?.googleSearch != null
          ? [
              {
                type: 'provider',
                id: 'google.google_search',
                name: 'google_search',
                args: googleImageOptions.googleSearch,
              },
            ]
          : undefined,
      headers,
      abortSignal,
    });

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();

    const images: string[] = [];
    for (const part of result.content) {
      if (
        part.type === 'file' &&
        part.mediaType.startsWith('image/') &&
        part.data.type === 'data'
      ) {
        images.push(convertToBase64(part.data.data));
      }
    }

    const languageModelGoogleMetadata =
      (result.providerMetadata?.google as
        | Record<string, unknown>
        | undefined) ?? {};

    return {
      images,
      warnings,
      providerMetadata: {
        google: {
          ...languageModelGoogleMetadata,
          images: images.map(() => ({})),
        },
      },
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: result.response?.headers,
      },
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens.total,
            outputTokens: result.usage.outputTokens.total,
            totalTokens:
              (result.usage.inputTokens.total ?? 0) +
              (result.usage.outputTokens.total ?? 0),
          }
        : undefined,
    };
  }
}

function isGeminiModel(modelId: string): boolean {
  return modelId.startsWith('gemini-');
}

// minimal version of the schema
const googleImageResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      predictions: z
        .array(z.object({ bytesBase64Encoded: z.string() }))
        .default([]),
    }),
  ),
);
