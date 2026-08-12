import type { ImageModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  convertImageModelFileToDataUri,
  createBinaryResponseHandler,
  createJsonResponseHandler,
  createStatusCodeErrorResponseHandler,
  delay,
  getFromApi,
  isSameOrigin,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import {
  asyncPollResponseSchema,
  asyncSubmitResponseSchema,
} from './fireworks-image-api';
import type { FireworksImageModelId } from './fireworks-image-options';

const DEFAULT_POLL_INTERVAL_MILLIS = 500;
const DEFAULT_POLL_TIMEOUT_MILLIS = 120000; // 2 minutes for image generation

interface FireworksImageModelBackendConfig {
  urlFormat: 'workflows' | 'workflows_async' | 'image_generation';
  supportsSize?: boolean;
  supportsEditing?: boolean;
}

const modelToBackendConfig: Partial<
  Record<FireworksImageModelId, FireworksImageModelBackendConfig>
> = {
  'accounts/fireworks/models/flux-1-dev-fp8': {
    urlFormat: 'workflows',
  },
  'accounts/fireworks/models/flux-1-schnell-fp8': {
    urlFormat: 'workflows',
  },
  'accounts/fireworks/models/flux-kontext-pro': {
    urlFormat: 'workflows_async',
    supportsEditing: true,
  },
  'accounts/fireworks/models/flux-kontext-max': {
    urlFormat: 'workflows_async',
    supportsEditing: true,
  },
  'accounts/fireworks/models/playground-v2-5-1024px-aesthetic': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
  'accounts/fireworks/models/japanese-stable-diffusion-xl': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
  'accounts/fireworks/models/playground-v2-1024px-aesthetic': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
  'accounts/fireworks/models/stable-diffusion-xl-1024-v1-0': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
  'accounts/fireworks/models/SSD-1B': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
};

function getUrlForModel(
  baseUrl: string,
  modelId: FireworksImageModelId,
): string {
  const config = modelToBackendConfig[modelId];

  switch (config?.urlFormat) {
    case 'image_generation':
      return `${baseUrl}/image_generation/${modelId}`;
    case 'workflows_async':
      return `${baseUrl}/workflows/${modelId}`;
    case 'workflows':
    default:
      return `${baseUrl}/workflows/${modelId}/text_to_image`;
  }
}

function getPollUrlForModel(
  baseUrl: string,
  modelId: FireworksImageModelId,
): string {
  return `${baseUrl}/workflows/${modelId}/get_result`;
}

interface FireworksImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
  /**
   * Poll interval in milliseconds between status checks for async models.
   * Defaults to 500ms.
   */
  pollIntervalMillis?: number;
  /**
   * Overall timeout in milliseconds for polling before giving up.
   * Defaults to 120000ms (2 minutes).
   */
  pollTimeoutMillis?: number;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class FireworksImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxImagesPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: FireworksImageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: FireworksImageModelId;
    config: FireworksImageModelConfig;
  }) {
    return new FireworksImageModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: FireworksImageModelId,
    private config: FireworksImageModelConfig,
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

    const backendConfig = modelToBackendConfig[this.modelId];
    if (!backendConfig?.supportsSize && size != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'size',
        details:
          'This model does not support the `size` option. Use `aspectRatio` instead.',
      });
    }

    // Use supportsSize as a proxy for whether the model does not support
    // aspectRatio. This invariant holds for the current set of models.
    if (backendConfig?.supportsSize && aspectRatio != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'aspectRatio',
        details: 'This model does not support the `aspectRatio` option.',
      });
    }

    // Handle files for image editing
    const hasInputImage = files != null && files.length > 0;
    let inputImage: string | undefined;

    if (hasInputImage) {
      inputImage = convertImageModelFileToDataUri(files[0]);

      if (files.length > 1) {
        warnings.push({
          type: 'other',
          message:
            'Fireworks only supports a single input image. Additional images are ignored.',
        });
      }
    }

    // Warn about mask - Fireworks Kontext models don't support explicit masks
    if (mask != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'mask',
        details:
          'Fireworks Kontext models do not support explicit masks. Use the prompt to describe the areas to edit.',
      });
    }

    const splitSize = size?.split('x');
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const combinedHeaders = combineHeaders(this.config.headers?.(), headers);

    const body = {
      prompt,
      aspect_ratio: aspectRatio,
      seed,
      samples: n,
      ...(inputImage && { input_image: inputImage }),
      ...(splitSize && { width: splitSize[0], height: splitSize[1] }),
      ...(providerOptions.fireworks ?? {}),
    };

    // Handle async models that require polling (e.g., flux-kontext-*)
    if (backendConfig?.urlFormat === 'workflows_async') {
      return this.doGenerateAsync({
        body,
        headers: combinedHeaders,
        abortSignal,
        warnings,
        currentDate,
      });
    }

    // Handle sync models that return binary directly
    const { value: response, responseHeaders } = await postJsonToApi({
      url: getUrlForModel(this.config.baseURL, this.modelId),
      headers: combinedHeaders,
      body,
      failedResponseHandler: createStatusCodeErrorResponseHandler(),
      successfulResponseHandler: createBinaryResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      images: [response],
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }

  /**
   * Handles async image generation for models like flux-kontext-* that return
   * a request_id and require polling for results.
   */
  private async doGenerateAsync({
    body,
    headers,
    abortSignal,
    warnings,
    currentDate,
  }: {
    body: Record<string, unknown>;
    headers: Record<string, string | undefined>;
    abortSignal: AbortSignal | undefined;
    warnings: Array<SharedV4Warning>;
    currentDate: Date;
  }): Promise<Awaited<ReturnType<ImageModelV4['doGenerate']>>> {
    // Submit the generation request
    const { value: submitResponse } = await postJsonToApi({
      url: getUrlForModel(this.config.baseURL, this.modelId),
      headers,
      body,
      failedResponseHandler: createStatusCodeErrorResponseHandler(),
      successfulResponseHandler: createJsonResponseHandler(
        asyncSubmitResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    const requestId = submitResponse.request_id;

    // Poll for the result
    const imageUrl = await this.pollForImageUrl({
      requestId,
      headers,
      abortSignal,
    });

    // Download the image from the URL. The URL comes from the provider
    // response and typically points at a CDN, so only send credentials when it
    // stays on the provider's own origin (never leak the API key to a CDN or an
    // attacker-named host).
    const { value: imageBytes, responseHeaders } = await getFromApi({
      url: imageUrl,
      headers: isSameOrigin(imageUrl, this.config.baseURL)
        ? headers
        : undefined,
      abortSignal,
      failedResponseHandler: createStatusCodeErrorResponseHandler(),
      successfulResponseHandler: createBinaryResponseHandler(),
      fetch: this.config.fetch,
    });

    return {
      images: [imageBytes],
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }

  /**
   * Polls the get_result endpoint until the image is ready.
   */
  private async pollForImageUrl({
    requestId,
    headers,
    abortSignal,
  }: {
    requestId: string;
    headers: Record<string, string | undefined>;
    abortSignal: AbortSignal | undefined;
  }): Promise<string> {
    const pollIntervalMillis =
      this.config.pollIntervalMillis ?? DEFAULT_POLL_INTERVAL_MILLIS;
    const pollTimeoutMillis =
      this.config.pollTimeoutMillis ?? DEFAULT_POLL_TIMEOUT_MILLIS;
    const maxPollAttempts = Math.ceil(
      pollTimeoutMillis / Math.max(1, pollIntervalMillis),
    );

    const pollUrl = getPollUrlForModel(this.config.baseURL, this.modelId);

    for (let i = 0; i < maxPollAttempts; i++) {
      const { value: pollResponse } = await postJsonToApi({
        url: pollUrl,
        headers,
        body: { id: requestId },
        failedResponseHandler: createStatusCodeErrorResponseHandler(),
        successfulResponseHandler: createJsonResponseHandler(
          asyncPollResponseSchema,
        ),
        abortSignal,
        fetch: this.config.fetch,
      });

      const status = pollResponse.status;

      if (status === 'Ready') {
        const imageUrl = pollResponse.result?.sample;
        if (typeof imageUrl === 'string') {
          return imageUrl;
        }
        throw new Error(
          'Fireworks poll response is Ready but missing result.sample',
        );
      }

      if (status === 'Error' || status === 'Failed') {
        throw new Error(
          `Fireworks image generation failed with status: ${status}`,
        );
      }

      // Wait before next poll attempt
      await delay(pollIntervalMillis);
    }

    throw new Error(
      `Fireworks image generation timed out after ${pollTimeoutMillis}ms`,
    );
  }
}
