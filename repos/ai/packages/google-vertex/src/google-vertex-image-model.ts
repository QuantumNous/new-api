import type { GoogleLanguageModelOptions } from '@ai-sdk/google';
import { GoogleLanguageModel } from '@ai-sdk/google/internal';
import type {
  ImageModelV4,
  ImageModelV4File,
  LanguageModelV4Prompt,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertToBase64,
  convertUint8ArrayToBase64,
  createJsonResponseHandler,
  generateId as defaultGenerateId,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { googleVertexFailedResponseHandler } from './google-vertex-error';
import { googleVertexImageModelOptionsSchema } from './google-vertex-image-model-options';
import type { GoogleVertexImageModelId } from './google-vertex-image-settings';

interface GoogleVertexImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: typeof fetch;
  generateId?: () => string;
  _internal?: {
    currentDate?: () => Date;
  };
}

// https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images
export class GoogleVertexImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';

  static [WORKFLOW_SERIALIZE](model: GoogleVertexImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: GoogleVertexImageModelConfig;
  }) {
    return new GoogleVertexImageModel(options.modelId, options.config);
  }

  get maxImagesPerCall(): number {
    if (isGeminiModel(this.modelId)) {
      return 10;
    }
    return 4;
  }

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: GoogleVertexImageModelId,
    private config: GoogleVertexImageModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<ImageModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<ImageModelV4['doGenerate']>>> {
    if (isGeminiModel(this.modelId)) {
      return this.doGenerateGemini(options);
    }
    return this.doGenerateImagen(options);
  }

  private async doGenerateImagen({
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

    if (size != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'size',
        details:
          'This model does not support the `size` option. Use `aspectRatio` instead.',
      });
    }

    const googleVertexImageOptions =
      (await parseProviderOptions({
        provider: 'googleVertex',
        providerOptions,
        schema: googleVertexImageModelOptionsSchema,
      })) ??
      (await parseProviderOptions({
        provider: 'vertex',
        providerOptions,
        schema: googleVertexImageModelOptionsSchema,
      }));

    // Extract edit-specific options from provider options
    const { edit, ...otherOptions } = googleVertexImageOptions ?? {};
    const { mode: editMode, baseSteps, maskMode, maskDilation } = edit ?? {};

    // Build the request body based on whether we're editing or generating
    const isEditMode = files != null && files.length > 0;

    let body: Record<string, unknown>;

    if (isEditMode) {
      // Build reference images for editing
      const referenceImages: Array<Record<string, unknown>> = [];

      // Add the source image(s)
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        referenceImages.push({
          referenceType: 'REFERENCE_TYPE_RAW',
          referenceId: i + 1,
          referenceImage: {
            bytesBase64Encoded: getBase64Data(file),
          },
        });
      }

      // Add mask if provided
      if (mask != null) {
        referenceImages.push({
          referenceType: 'REFERENCE_TYPE_MASK',
          referenceId: files.length + 1,
          referenceImage: {
            bytesBase64Encoded: getBase64Data(mask),
          },
          maskImageConfig: {
            maskMode: maskMode ?? 'MASK_MODE_USER_PROVIDED',
            ...(maskDilation != null ? { dilation: maskDilation } : {}),
          },
        });
      }

      body = {
        instances: [
          {
            prompt,
            referenceImages,
          },
        ],
        parameters: {
          sampleCount: n,
          ...(aspectRatio != null ? { aspectRatio } : {}),
          ...(seed != null ? { seed } : {}),
          editMode: editMode ?? 'EDIT_MODE_INPAINT_INSERTION',
          ...(baseSteps != null ? { editConfig: { baseSteps } } : {}),
          ...otherOptions,
        },
      };
    } else {
      // Standard image generation
      body = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: n,
          ...(aspectRatio != null ? { aspectRatio } : {}),
          ...(seed != null ? { seed } : {}),
          ...otherOptions,
        },
      };
    }

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { value: response, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/models/${this.modelId}:predict`,
      headers: combineHeaders(
        this.config.headers ? await resolve(this.config.headers) : undefined,
        headers,
      ),
      body,
      failedResponseHandler: googleVertexFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        googleVertexImageResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      images:
        response.predictions?.map(
          ({ bytesBase64Encoded }) => bytesBase64Encoded,
        ) ?? [],
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
      providerMetadata: (() => {
        const payload = {
          images:
            response.predictions?.map(prediction => {
              const {
                // normalize revised prompt property
                prompt: revisedPrompt,
              } = prediction;

              return { ...(revisedPrompt != null && { revisedPrompt }) };
            }) ?? [],
        };
        return { googleVertex: payload, vertex: payload };
      })(),
    };
  }

  private async doGenerateGemini({
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

    if (mask != null) {
      throw new Error(
        'Gemini image models do not support mask-based image editing.',
      );
    }

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

    const languageModel = new GoogleLanguageModel(this.modelId, {
      provider: this.config.provider,
      baseURL: this.config.baseURL,
      headers: this.config.headers ?? {},
      fetch: this.config.fetch,
      generateId: this.config.generateId ?? defaultGenerateId,
      supportedUrls: () => ({
        '*': [/^https?:\/\/.*$/, /^gs:\/\/.*$/],
      }),
    });

    const userVertexOptions = (providerOptions?.googleVertex ??
      providerOptions?.vertex) as
      | Omit<GoogleLanguageModelOptions, 'responseModalities' | 'imageConfig'>
      | undefined;
    const innerVertexOptions: GoogleLanguageModelOptions = {
      responseModalities: ['IMAGE'],
      imageConfig: aspectRatio
        ? {
            aspectRatio: aspectRatio as NonNullable<
              GoogleLanguageModelOptions['imageConfig']
            >['aspectRatio'],
          }
        : undefined,
      ...(userVertexOptions ?? {}),
    };
    const result = await languageModel.doGenerate({
      prompt: languageModelPrompt,
      seed,
      providerOptions: {
        googleVertex: innerVertexOptions,
        vertex: innerVertexOptions,
      },
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

    const geminiPayload = {
      images: images.map(() => ({})),
    };
    return {
      images,
      warnings,
      providerMetadata: {
        googleVertex: geminiPayload,
        vertex: geminiPayload,
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

// minimal version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const googleVertexImageResponseSchema = z.object({
  predictions: z
    .array(
      z.object({
        bytesBase64Encoded: z.string(),
        mimeType: z.string(),
        prompt: z.string().nullish(),
      }),
    )
    .nullish(),
});

/**
 * Helper to convert ImageModelV4File data to base64 string
 */
function getBase64Data(file: ImageModelV4File): string {
  if (file.type === 'url') {
    throw new Error(
      'URL-based images are not supported for Google Vertex image editing. Please provide the image data directly.',
    );
  }

  if (typeof file.data === 'string') {
    return file.data;
  }

  // Convert Uint8Array to base64
  return convertUint8ArrayToBase64(file.data);
}
