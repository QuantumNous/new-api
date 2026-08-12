import {
  AISDKError,
  type Experimental_VideoModelV4,
  type Experimental_VideoModelV4File,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertImageModelFileToDataUri,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  delay,
  getFromApi,
  getTopLevelMediaType,
  parseProviderOptions,
  postJsonToApi,
  resolve,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { ByteDanceConfig } from './bytedance-config';
import {
  byteDanceVideoModelOptionsSchema,
  type ByteDanceVideoModelOptions,
} from './bytedance-video-model-options';
import type { ByteDanceVideoModelId } from './bytedance-video-settings';

const HANDLED_PROVIDER_OPTIONS = new Set([
  'watermark',
  'generateAudio',
  'cameraFixed',
  'returnLastFrame',
  'serviceTier',
  'draft',
  'lastFrameImage',
  'referenceImages',
  'referenceVideos',
  'referenceAudio',
  'pollIntervalMs',
  'pollTimeoutMs',
]);

const RESOLUTION_MAP: Record<string, string> = {
  '864x496': '480p',
  '496x864': '480p',
  '752x560': '480p',
  '560x752': '480p',
  '640x640': '480p',
  '992x432': '480p',
  '432x992': '480p',
  '864x480': '480p',
  '480x864': '480p',
  '736x544': '480p',
  '544x736': '480p',
  '960x416': '480p',
  '416x960': '480p',
  '832x480': '480p',
  '480x832': '480p',
  '624x624': '480p',
  '1280x720': '720p',
  '720x1280': '720p',
  '1112x834': '720p',
  '834x1112': '720p',
  '960x960': '720p',
  '1470x630': '720p',
  '630x1470': '720p',
  '1248x704': '720p',
  '704x1248': '720p',
  '1120x832': '720p',
  '832x1120': '720p',
  '1504x640': '720p',
  '640x1504': '720p',
  '1920x1080': '1080p',
  '1080x1920': '1080p',
  '1664x1248': '1080p',
  '1248x1664': '1080p',
  '1440x1440': '1080p',
  '2206x946': '1080p',
  '946x2206': '1080p',
  '1920x1088': '1080p',
  '1088x1920': '1080p',
  '2176x928': '1080p',
  '928x2176': '1080p',
};

interface ByteDanceVideoModelConfig extends ByteDanceConfig {
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

const isVideoFile = (f: Experimental_VideoModelV4File) =>
  f.mediaType != null && getTopLevelMediaType(f.mediaType) === 'video';

function resolveReferenceContent(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  byteDanceOptions: ByteDanceVideoModelOptions | undefined,
  warnings: SharedV4Warning[],
): Array<Record<string, unknown>> {
  if (options.frameImages != null && options.frameImages.length > 0) {
    return [];
  }

  const inputReferences = options.inputReferences;

  if (inputReferences != null && inputReferences.length > 0) {
    return inputReferences.map(reference => {
      if (reference.type === 'url' && reference.mediaType == null) {
        warnings.push({
          type: 'unsupported',
          feature: 'inputReferences',
          details:
            'ByteDance requires an explicit mediaType to route URL references as ' +
            'video or image. Pass { data: url, mediaType: "video/mp4" } for video ' +
            'references. The reference was treated as an image.',
        });
      }

      const url = convertImageModelFileToDataUri(reference);
      return isVideoFile(reference)
        ? { type: 'video_url', video_url: { url }, role: 'reference_video' }
        : { type: 'image_url', image_url: { url }, role: 'reference_image' };
    });
  }

  const content: Array<Record<string, unknown>> = [];

  for (const imageUrl of byteDanceOptions?.referenceImages ?? []) {
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl },
      role: 'reference_image',
    });
  }

  for (const videoUrl of byteDanceOptions?.referenceVideos ?? []) {
    content.push({
      type: 'video_url',
      video_url: { url: videoUrl },
      role: 'reference_video',
    });
  }

  return content;
}

function resolveLastFrameImage(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  byteDanceOptions: ByteDanceVideoModelOptions | undefined,
): string | undefined {
  const lastFrame = options.frameImages?.find(
    frame => frame.frameType === 'last_frame',
  )?.image;

  if (lastFrame != null) {
    return convertImageModelFileToDataUri(lastFrame);
  }

  return byteDanceOptions?.lastFrameImage ?? undefined;
}

export class ByteDanceVideoModel implements Experimental_VideoModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxVideosPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: ByteDanceVideoModelId,
    private readonly config: ByteDanceVideoModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<Experimental_VideoModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const warnings: SharedV4Warning[] = [];

    const byteDanceOptions = (await parseProviderOptions({
      provider: 'bytedance',
      providerOptions: options.providerOptions,
      schema: byteDanceVideoModelOptionsSchema,
    })) as ByteDanceVideoModelOptions | undefined;

    // Warn about unsupported standard options
    if (options.fps) {
      warnings.push({
        type: 'unsupported',
        feature: 'fps',
        details:
          'ByteDance video models do not support custom FPS. Frame rate is fixed at 24 fps.',
      });
    }

    if (options.n != null && options.n > 1) {
      warnings.push({
        type: 'unsupported',
        feature: 'n',
        details:
          'ByteDance video models do not support generating multiple videos per call. ' +
          'Only 1 video will be generated.',
      });
    }

    const content: Array<Record<string, unknown>> = [];

    if (options.prompt != null) {
      content.push({
        type: 'text',
        text: options.prompt,
      });
    }

    const startImage = resolveStartImage(options);
    const lastFrameImageUrl = resolveLastFrameImage(options, byteDanceOptions);
    const referenceContent = resolveReferenceContent(
      options,
      byteDanceOptions,
      warnings,
    );

    if (startImage != null) {
      content.push({
        type: 'image_url',
        image_url: { url: convertImageModelFileToDataUri(startImage) },
        ...(lastFrameImageUrl != null ? { role: 'first_frame' } : {}),
      });
    }

    // Add last frame image if provided
    if (lastFrameImageUrl != null) {
      content.push({
        type: 'image_url',
        image_url: { url: lastFrameImageUrl },
        role: 'last_frame',
      });
    }

    for (const entry of referenceContent) {
      content.push(entry);
    }

    // Add reference audio if provided
    if (
      byteDanceOptions?.referenceAudio != null &&
      byteDanceOptions.referenceAudio.length > 0
    ) {
      for (const audioUrl of byteDanceOptions.referenceAudio) {
        content.push({
          type: 'audio_url',
          audio_url: { url: audioUrl },
          role: 'reference_audio',
        });
      }
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      content,
    };

    if (options.aspectRatio) {
      body.ratio = options.aspectRatio;
    }

    if (options.duration) {
      body.duration = options.duration;
    }

    if (options.seed) {
      body.seed = options.seed;
    }

    if (options.resolution) {
      const mapped = RESOLUTION_MAP[options.resolution];
      if (mapped) {
        body.resolution = mapped;
      } else {
        body.resolution = options.resolution;
      }
    }

    const generateAudio =
      options.generateAudio ?? byteDanceOptions?.generateAudio;
    if (generateAudio != null) {
      body.generate_audio = generateAudio;
    }

    if (byteDanceOptions != null) {
      if (byteDanceOptions.watermark != null) {
        body.watermark = byteDanceOptions.watermark;
      }
      if (byteDanceOptions.cameraFixed != null) {
        body.camera_fixed = byteDanceOptions.cameraFixed;
      }
      if (byteDanceOptions.returnLastFrame != null) {
        body.return_last_frame = byteDanceOptions.returnLastFrame;
      }
      if (byteDanceOptions.serviceTier != null) {
        body.service_tier = byteDanceOptions.serviceTier;
      }
      if (byteDanceOptions.draft != null) {
        body.draft = byteDanceOptions.draft;
      }
      // Pass through any additional options not explicitly handled
      for (const [key, value] of Object.entries(byteDanceOptions)) {
        if (!HANDLED_PROVIDER_OPTIONS.has(key)) {
          body[key] = value;
        }
      }
    }

    const createUrl = `${this.config.baseURL}/contents/generations/tasks`;

    const { value: createResponse } = await postJsonToApi({
      url: createUrl,
      headers: combineHeaders(
        await resolve(this.config.headers),
        options.headers,
      ),
      body,
      failedResponseHandler: byteDanceFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        byteDanceTaskResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const taskId = createResponse.id;

    if (!taskId) {
      throw new AISDKError({
        name: 'BYTEDANCE_VIDEO_GENERATION_ERROR',
        message: 'No task ID returned from API',
      });
    }

    const pollIntervalMs = byteDanceOptions?.pollIntervalMs ?? 3000;
    const pollTimeoutMs = byteDanceOptions?.pollTimeoutMs ?? 300000;

    const startTime = Date.now();
    let response: ByteDanceResponse;
    let responseHeaders: Record<string, string> | undefined;

    while (true) {
      const statusUrl = `${this.config.baseURL}/contents/generations/tasks/${taskId}`;

      const { value: statusResponse, responseHeaders: statusHeaders } =
        await getFromApi({
          url: statusUrl,
          validateUrl: false,
          headers: combineHeaders(
            await resolve(this.config.headers),
            options.headers,
          ),
          failedResponseHandler: byteDanceFailedResponseHandler,
          successfulResponseHandler: createJsonResponseHandler(
            byteDanceStatusResponseSchema,
          ),
          abortSignal: options.abortSignal,
          fetch: this.config.fetch,
        });

      if (statusResponse.status === 'succeeded') {
        response = statusResponse;
        responseHeaders = statusHeaders;
        break;
      }

      if (statusResponse.status === 'failed') {
        throw new AISDKError({
          name: 'BYTEDANCE_VIDEO_GENERATION_FAILED',
          message: `Video generation failed: ${JSON.stringify(statusResponse)}`,
        });
      }

      if (Date.now() - startTime > pollTimeoutMs) {
        throw new AISDKError({
          name: 'BYTEDANCE_VIDEO_GENERATION_TIMEOUT',
          message: `Video generation timed out after ${pollTimeoutMs}ms`,
        });
      }

      await delay(pollIntervalMs, { abortSignal: options.abortSignal });
    }

    const videoUrl = response.content?.video_url;
    if (!videoUrl) {
      throw new AISDKError({
        name: 'BYTEDANCE_VIDEO_GENERATION_ERROR',
        message: 'No video URL in response',
      });
    }

    return {
      videos: [
        {
          type: 'url',
          url: videoUrl,
          mediaType: 'video/mp4',
        },
      ],
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
      providerMetadata: {
        bytedance: {
          taskId,
          usage: response.usage,
        },
      },
    };
  }
}

const byteDanceTaskResponseSchema = z.object({
  id: z.string().nullish(),
});

type ByteDanceResponse = z.infer<typeof byteDanceStatusResponseSchema>;

const byteDanceStatusResponseSchema = z.object({
  id: z.string().nullish(),
  model: z.string().nullish(),
  status: z.string(),
  content: z
    .object({
      video_url: z.string().nullish(),
    })
    .nullish(),
  usage: z
    .object({
      completion_tokens: z.number().nullish(),
    })
    .nullish(),
});

const byteDanceErrorSchema = z.object({
  error: z
    .object({
      message: z.string(),
      code: z.string().nullish(),
    })
    .nullish(),
  message: z.string().nullish(),
});

const byteDanceFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: byteDanceErrorSchema,
  errorToMessage: data =>
    data.error?.message ?? data.message ?? 'Unknown error',
});
