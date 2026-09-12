import {
  AISDKError,
  type Experimental_VideoModelV4,
  type Experimental_VideoModelV4File,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertUint8ArrayToBase64,
  createJsonResponseHandler,
  delay,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { googleVertexFailedResponseHandler } from './google-vertex-error';
import {
  googleVertexVideoModelOptionsSchema,
  type GoogleVertexVideoModelOptions,
} from './google-vertex-video-model-options';
import type { GoogleVertexVideoModelId } from './google-vertex-video-settings';

interface GoogleVertexVideoModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  generateId?: () => string;
  _internal?: {
    currentDate?: () => Date;
  };
}

function getFirstFrameImage(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
): Experimental_VideoModelV4File | undefined {
  return options.frameImages?.find(frame => frame.frameType === 'first_frame')
    ?.image;
}

function resolveStartImage(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
): Experimental_VideoModelV4File | undefined {
  return getFirstFrameImage(options) ?? options.image;
}

function getLastFrameImage(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
): Experimental_VideoModelV4File | undefined {
  return options.frameImages?.find(frame => frame.frameType === 'last_frame')
    ?.image;
}

function getInputReferences(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
): Array<Experimental_VideoModelV4File> | undefined {
  if (options.frameImages != null && options.frameImages.length > 0) {
    return undefined;
  }

  return options.inputReferences != null && options.inputReferences.length > 0
    ? options.inputReferences
    : undefined;
}

function convertFileToVertexImage(
  file: Experimental_VideoModelV4File,
  warnings: SharedV4Warning[],
): Record<string, unknown> | undefined {
  if (file.type === 'url') {
    if (file.url.startsWith('gs://')) {
      return {
        gcsUri: file.url,
        mimeType: 'image/png',
      };
    }

    warnings.push({
      type: 'unsupported',
      feature: 'URL-based image input',
      details:
        'Vertex AI video models require base64-encoded images or GCS URIs. URL will be ignored.',
    });
    return undefined;
  }

  const base64Data =
    typeof file.data === 'string'
      ? file.data
      : convertUint8ArrayToBase64(file.data);

  return {
    bytesBase64Encoded: base64Data,
    mimeType: file.mediaType || 'image/png',
  };
}

function convertInputReferenceImage(
  file: Experimental_VideoModelV4File,
  warnings: SharedV4Warning[],
): Record<string, unknown> | undefined {
  const image = convertFileToVertexImage(file, warnings);
  return image != null ? { image, referenceType: 'asset' } : undefined;
}

export class GoogleVertexVideoModel implements Experimental_VideoModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  get maxVideosPerCall(): number {
    // Vertex supports multiple videos via sampleCount
    return 4;
  }

  constructor(
    readonly modelId: GoogleVertexVideoModelId,
    private readonly config: GoogleVertexVideoModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<Experimental_VideoModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const warnings: SharedV4Warning[] = [];

    const googleVertexOptions = ((await parseProviderOptions({
      provider: 'googleVertex',
      providerOptions: options.providerOptions,
      schema: googleVertexVideoModelOptionsSchema,
    })) ??
      (await parseProviderOptions({
        provider: 'vertex',
        providerOptions: options.providerOptions,
        schema: googleVertexVideoModelOptionsSchema,
      }))) as GoogleVertexVideoModelOptions | undefined;

    const instances: Array<Record<string, unknown>> = [{}];
    const instance = instances[0];

    if (options.prompt != null) {
      instance.prompt = options.prompt;
    }

    const startImage = resolveStartImage(options);
    if (startImage != null) {
      const image = convertFileToVertexImage(startImage, warnings);
      if (image != null) {
        instance.image = image;
      }
    }

    const lastFrameImage = getLastFrameImage(options);
    if (lastFrameImage != null) {
      const lastFrame = convertFileToVertexImage(lastFrameImage, warnings);
      if (lastFrame != null) {
        instance.lastFrame = lastFrame;
      }
    }

    const inputReferences = getInputReferences(options);
    if (inputReferences != null) {
      instance.referenceImages = inputReferences.flatMap(reference => {
        const converted = convertInputReferenceImage(reference, warnings);
        return converted != null ? [converted] : [];
      });
    } else if (googleVertexOptions?.referenceImages != null) {
      instance.referenceImages = googleVertexOptions.referenceImages;
    }

    const parameters: Record<string, unknown> = {
      sampleCount: options.n,
    };

    if (options.aspectRatio) {
      parameters.aspectRatio = options.aspectRatio;
    }

    if (options.resolution) {
      const resolutionMap: Record<string, string> = {
        '1280x720': '720p',
        '1920x1080': '1080p',
        '3840x2160': '4k',
      };
      parameters.resolution =
        resolutionMap[options.resolution] || options.resolution;
    }

    if (options.duration) {
      parameters.durationSeconds = options.duration;
    }

    if (options.seed) {
      parameters.seed = options.seed;
    }

    const generateAudio =
      options.generateAudio ?? googleVertexOptions?.generateAudio;
    if (generateAudio != null) {
      parameters.generateAudio = generateAudio;
    }

    if (googleVertexOptions != null) {
      const opts = googleVertexOptions;

      if (
        opts.personGeneration !== undefined &&
        opts.personGeneration !== null
      ) {
        parameters.personGeneration = opts.personGeneration;
      }
      if (opts.negativePrompt !== undefined && opts.negativePrompt !== null) {
        parameters.negativePrompt = opts.negativePrompt;
      }
      if (
        opts.gcsOutputDirectory !== undefined &&
        opts.gcsOutputDirectory !== null
      ) {
        parameters.gcsOutputDirectory = opts.gcsOutputDirectory;
      }

      for (const [key, value] of Object.entries(opts)) {
        if (
          ![
            'pollIntervalMs',
            'pollTimeoutMs',
            'personGeneration',
            'negativePrompt',
            'generateAudio',
            'gcsOutputDirectory',
            'referenceImages',
          ].includes(key)
        ) {
          parameters[key] = value;
        }
      }
    }

    const { value: operation } = await postJsonToApi({
      url: `${this.config.baseURL}/models/${this.modelId}:predictLongRunning`,
      headers: combineHeaders(
        await resolve(this.config.headers),
        options.headers,
      ),
      body: {
        instances,
        parameters,
      },
      successfulResponseHandler: createJsonResponseHandler(
        googleVertexOperationSchema,
      ),
      failedResponseHandler: googleVertexFailedResponseHandler,
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const operationName = operation.name;
    if (!operationName) {
      throw new AISDKError({
        name: 'VERTEX_VIDEO_GENERATION_ERROR',
        message: 'No operation name returned from API',
      });
    }

    const pollIntervalMs = googleVertexOptions?.pollIntervalMs ?? 10000; // 10 seconds
    const pollTimeoutMs = googleVertexOptions?.pollTimeoutMs ?? 600000; // 10 minutes

    const startTime = Date.now();
    let finalOperation = operation;
    let responseHeaders: Record<string, string> | undefined;

    while (!finalOperation.done) {
      if (Date.now() - startTime > pollTimeoutMs) {
        throw new AISDKError({
          name: 'VERTEX_VIDEO_GENERATION_TIMEOUT',
          message: `Video generation timed out after ${pollTimeoutMs}ms`,
        });
      }

      await delay(pollIntervalMs);

      if (options.abortSignal?.aborted) {
        throw new AISDKError({
          name: 'VERTEX_VIDEO_GENERATION_ABORTED',
          message: 'Video generation request was aborted',
        });
      }

      const { value: statusOperation, responseHeaders: pollHeaders } =
        await postJsonToApi({
          url: `${this.config.baseURL}/models/${this.modelId}:fetchPredictOperation`,
          headers: combineHeaders(
            await resolve(this.config.headers),
            options.headers,
          ),
          body: {
            operationName,
          },
          successfulResponseHandler: createJsonResponseHandler(
            googleVertexOperationSchema,
          ),
          failedResponseHandler: googleVertexFailedResponseHandler,
          abortSignal: options.abortSignal,
          fetch: this.config.fetch,
        });

      finalOperation = statusOperation;
      responseHeaders = pollHeaders;
    }

    if (finalOperation.error) {
      throw new AISDKError({
        name: 'VERTEX_VIDEO_GENERATION_FAILED',
        message: `Video generation failed: ${finalOperation.error.message}`,
      });
    }

    const response = finalOperation.response;
    if (!response?.videos || response.videos.length === 0) {
      throw new AISDKError({
        name: 'VERTEX_VIDEO_GENERATION_ERROR',
        message: `No videos in response. Response: ${JSON.stringify(finalOperation)}`,
      });
    }

    // Process videos - Vertex returns base64 encoded videos or GCS URIs
    const videos: Array<
      | { type: 'base64'; data: string; mediaType: string }
      | { type: 'url'; url: string; mediaType: string }
    > = [];
    const videoMetadata: Array<{
      gcsUri?: string | null | undefined;
      mimeType?: string | null | undefined;
    }> = [];

    for (const video of response.videos) {
      if (video.bytesBase64Encoded) {
        videos.push({
          type: 'base64',
          data: video.bytesBase64Encoded,
          mediaType: video.mimeType || 'video/mp4',
        });
        videoMetadata.push({
          mimeType: video.mimeType,
        });
      } else if (video.gcsUri) {
        videos.push({
          type: 'url',
          url: video.gcsUri,
          mediaType: video.mimeType || 'video/mp4',
        });
        videoMetadata.push({
          gcsUri: video.gcsUri,
          mimeType: video.mimeType,
        });
      }
    }

    if (videos.length === 0) {
      throw new AISDKError({
        name: 'VERTEX_VIDEO_GENERATION_ERROR',
        message: 'No valid videos in response',
      });
    }

    return {
      videos,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
      providerMetadata: (() => {
        const payload = { videos: videoMetadata };
        return {
          googleVertex: payload,
          // Legacy keys preserved for backward compatibility.
          'google-vertex': payload,
          vertex: payload,
        };
      })(),
    };
  }
}

const googleVertexOperationSchema = z.object({
  name: z.string().nullish(),
  done: z.boolean().nullish(),
  error: z
    .object({
      code: z.number().nullish(),
      message: z.string(),
      status: z.string().nullish(),
    })
    .nullish(),
  response: z
    .object({
      videos: z
        .array(
          z.object({
            bytesBase64Encoded: z.string().nullish(),
            gcsUri: z.string().nullish(),
            mimeType: z.string().nullish(),
          }),
        )
        .nullish(),
      raiMediaFilteredCount: z.number().nullish(),
    })
    .nullish(),
});
