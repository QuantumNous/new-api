import {
  AISDKError,
  type Experimental_VideoModelV4,
  type Experimental_VideoModelV4File,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertImageModelFileToDataUri,
  convertUint8ArrayToBase64,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  delay,
  getFromApi,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import {
  alibabaVideoModelOptionsSchema,
  type AlibabaVideoModelOptions,
} from './alibaba-video-model-options';
import type { AlibabaVideoModelId } from './alibaba-video-settings';

interface AlibabaVideoModelConfig {
  provider: string;
  baseURL: string;
  headers: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

// DashScope native API error format (different from OpenAI-compatible endpoint)
const alibabaVideoErrorSchema = z.object({
  code: z.string().nullish(),
  message: z.string(),
  request_id: z.string().nullish(),
});

const alibabaVideoFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: alibabaVideoErrorSchema,
  errorToMessage: data => data.message,
});

const alibabaVideoCreateTaskSchema = z.object({
  output: z
    .object({
      task_status: z.string(),
      task_id: z.string(),
    })
    .nullish(),
  request_id: z.string().nullish(),
});

const alibabaVideoTaskStatusSchema = z.object({
  output: z
    .object({
      task_id: z.string(),
      task_status: z.string(),
      video_url: z.string().nullish(),
      submit_time: z.string().nullish(),
      scheduled_time: z.string().nullish(),
      end_time: z.string().nullish(),
      orig_prompt: z.string().nullish(),
      actual_prompt: z.string().nullish(),
      code: z.string().nullish(),
      message: z.string().nullish(),
    })
    .nullish(),
  usage: z
    .object({
      duration: z.number().nullish(),
      output_video_duration: z.number().nullish(),
      SR: z.number().nullish(),
      size: z.string().nullish(),
    })
    .nullish(),
  request_id: z.string().nullish(),
});

type AlibabaVideoTaskStatusResponse = z.infer<
  typeof alibabaVideoTaskStatusSchema
>;

function detectMode(modelId: string): 't2v' | 'i2v' | 'r2v' {
  if (modelId.includes('-i2v')) return 'i2v';
  if (modelId.includes('-r2v')) return 'r2v';
  return 't2v';
}

// wan2.7 models use a different protocol than earlier wan models:
// resolution tiers + ratio instead of size, input.media instead of
// input.reference_urls (R2V), and no shot_type or audio parameters.
function isWan27Model(modelId: string): boolean {
  return modelId.startsWith('wan2.7');
}

// Maps SDK "WIDTHxHEIGHT" resolutions to Alibaba resolution tiers.
const resolutionTierMap: Record<string, string> = {
  '1280x720': '720P',
  '720x1280': '720P',
  '960x960': '720P',
  '1088x832': '720P',
  '832x1088': '720P',
  '1920x1080': '1080P',
  '1080x1920': '1080P',
  '1440x1440': '1080P',
  '1632x1248': '1080P',
  '1248x1632': '1080P',
  '832x480': '480P',
  '480x832': '480P',
  '624x624': '480P',
};

const supportedRatios = new Set(['16:9', '9:16', '1:1', '4:3', '3:4']);

function deriveRatioFromResolution(
  resolution: `${number}x${number}`,
): string | undefined {
  const [width, height] = resolution.split('x').map(Number);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined;
  }
  let a = width;
  let b = height;
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  const ratio = `${width / a}:${height / a}`;
  return supportedRatios.has(ratio) ? ratio : undefined;
}

function fileToImageString(file: Experimental_VideoModelV4File): string {
  if (file.type === 'url') {
    return file.url;
  }
  return typeof file.data === 'string'
    ? file.data
    : convertUint8ArrayToBase64(file.data);
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

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov)([?#]|$)/i.test(url);
}

// Builds the wan2.7 input.media array from inputReferences and frameImages.
function resolveMedia(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  alibabaOptions: AlibabaVideoModelOptions | undefined,
  warnings: SharedV4Warning[],
): Array<Record<string, unknown>> | undefined {
  if (alibabaOptions?.media != null && alibabaOptions.media.length > 0) {
    return alibabaOptions.media.map(item => ({
      type: item.type,
      url: item.url,
      ...(item.referenceVoice != null
        ? { reference_voice: item.referenceVoice }
        : {}),
    }));
  }

  const media: Array<Record<string, unknown>> = [];

  for (const reference of options.inputReferences ?? []) {
    if (reference.type === 'url') {
      media.push({
        type: isVideoUrl(reference.url) ? 'reference_video' : 'reference_image',
        url: reference.url,
      });
    } else if (reference.mediaType.startsWith('image/')) {
      media.push({
        type: 'reference_image',
        url: convertImageModelFileToDataUri(reference),
      });
    } else {
      warnings.push({
        type: 'unsupported',
        feature: 'inputReferences',
        details:
          'Alibaba reference-to-video requires URL references for videos. ' +
          'Non-URL video reference was skipped.',
      });
    }
  }

  const firstFrame = getFirstFrameImage(options);
  if (firstFrame != null) {
    media.push({
      type: 'first_frame',
      url: convertImageModelFileToDataUri(firstFrame),
    });
  }

  return media.length > 0 ? media : undefined;
}

function resolveReferenceUrls(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  alibabaOptions: AlibabaVideoModelOptions | undefined,
  warnings: SharedV4Warning[],
): string[] | undefined {
  if (options.frameImages != null && options.frameImages.length > 0) {
    return undefined;
  }

  if (options.inputReferences != null && options.inputReferences.length > 0) {
    const urls: string[] = [];

    for (const reference of options.inputReferences) {
      if (reference.type === 'url') {
        urls.push(reference.url);
      } else {
        warnings.push({
          type: 'unsupported',
          feature: 'inputReferences',
          details:
            'Alibaba reference-to-video requires URL references. ' +
            'Non-URL reference was skipped.',
        });
      }
    }

    return urls.length > 0 ? urls : undefined;
  }

  return alibabaOptions?.referenceUrls ?? undefined;
}

export class AlibabaVideoModel implements Experimental_VideoModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxVideosPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: AlibabaVideoModelId,
    private readonly config: AlibabaVideoModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<Experimental_VideoModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const warnings: SharedV4Warning[] = [];
    const mode = detectMode(this.modelId);

    const alibabaOptions = (await parseProviderOptions({
      provider: 'alibaba',
      providerOptions: options.providerOptions,
      schema: alibabaVideoModelOptionsSchema,
    })) as AlibabaVideoModelOptions | undefined;

    // Build input object
    const input: Record<string, unknown> = {};

    if (options.prompt != null) {
      input.prompt = options.prompt;
    }

    if (alibabaOptions?.negativePrompt != null) {
      input.negative_prompt = alibabaOptions.negativePrompt;
    }

    if (alibabaOptions?.audioUrl != null) {
      input.audio_url = alibabaOptions.audioUrl;
    }

    const startImage = resolveStartImage(options);
    const wan27 = isWan27Model(this.modelId);
    // wan2.7 T2V and R2V take an explicit aspect ratio (I2V follows the input image)
    const supportsRatio = wan27 && mode !== 'i2v';

    // Handle image input for I2V mode
    if (mode === 'i2v' && startImage != null) {
      input.img_url = fileToImageString(startImage);
    }

    // Handle references for R2V mode
    if (mode === 'r2v') {
      if (wan27) {
        // wan2.7: input.media
        const media = resolveMedia(options, alibabaOptions, warnings);
        if (media != null) {
          input.media = media;
        }
      } else {
        // wan2.6: legacy protocol with input.reference_urls
        const referenceUrls = resolveReferenceUrls(
          options,
          alibabaOptions,
          warnings,
        );
        if (referenceUrls != null && referenceUrls.length > 0) {
          input.reference_urls = referenceUrls;
        }
      }
    }

    const lastFrame = options.frameImages?.find(
      frame => frame.frameType === 'last_frame',
    )?.image;

    if (lastFrame != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'frameImages',
        details:
          'This model does not support last_frame. ' +
          'The last frame image was ignored.',
      });
    }

    if (
      options.inputReferences != null &&
      options.inputReferences.length > 0 &&
      mode !== 'r2v'
    ) {
      warnings.push({
        type: 'unsupported',
        feature: 'inputReferences',
        details:
          'Alibaba only supports inputReferences (reference-to-video) on ' +
          'reference-to-video models. The reference images were ignored.',
      });
    }

    // Build parameters object
    const parameters: Record<string, unknown> = {};

    if (options.duration != null) {
      parameters.duration = options.duration;
    }

    if (options.seed != null) {
      parameters.seed = options.seed;
    }

    // Resolution / Size mapping
    if (options.resolution != null) {
      if (mode === 'i2v' || wan27) {
        // I2V and wan2.7 models use "720P" / "1080P" format
        const resolutionTier =
          resolutionTierMap[options.resolution] || options.resolution;
        if (wan27 && resolutionTier !== '720P' && resolutionTier !== '1080P') {
          warnings.push({
            type: 'unsupported',
            feature: 'resolution',
            details:
              'wan2.7 models only support 720P and 1080P ' +
              `resolutions. The resolution "${options.resolution}" was ignored.`,
          });
        } else {
          parameters.resolution = resolutionTier;
        }
      } else {
        // wan2.6 T2V and R2V use "WIDTH*HEIGHT" format for the size parameter
        // Convert "WIDTHxHEIGHT" (SDK standard) to "WIDTH*HEIGHT" (Alibaba API)
        parameters.size = options.resolution.replace('x', '*');
      }
    }

    // wan2.7 T2V and R2V support an explicit aspect ratio parameter
    if (supportsRatio) {
      const ratio =
        alibabaOptions?.ratio ??
        options.aspectRatio ??
        (options.resolution != null
          ? deriveRatioFromResolution(options.resolution)
          : undefined);
      if (ratio != null) {
        parameters.ratio = ratio;
      }
    }

    // Provider-specific parameters
    if (alibabaOptions?.promptExtend != null) {
      parameters.prompt_extend = alibabaOptions.promptExtend;
    }
    if (alibabaOptions?.shotType != null) {
      if (wan27) {
        // wan2.7 removed shot_type; shot structure is described in the prompt
        warnings.push({
          type: 'unsupported',
          feature: 'shotType',
          details:
            'wan2.7 models do not support the shotType option. ' +
            'Describe the shot structure in the prompt instead.',
        });
      } else {
        parameters.shot_type = alibabaOptions.shotType;
      }
    }
    if (alibabaOptions?.watermark != null) {
      parameters.watermark = alibabaOptions.watermark;
    }
    const audio = options.generateAudio ?? alibabaOptions?.audio;
    if (audio != null) {
      if (wan27) {
        // wan2.7 does not have an audio parameter (audio is always generated)
        warnings.push({
          type: 'unsupported',
          feature: 'generateAudio',
          details:
            'wan2.7 models always generate audio. ' +
            'The audio option was ignored.',
        });
      } else {
        parameters.audio = audio;
      }
    }

    // Warn about unsupported standard options
    if (options.aspectRatio && !supportsRatio) {
      warnings.push({
        type: 'unsupported',
        feature: 'aspectRatio',
        details:
          'Alibaba video models use explicit size/resolution dimensions. Use the resolution option or providerOptions.alibaba for size control.',
      });
    }
    if (options.fps) {
      warnings.push({
        type: 'unsupported',
        feature: 'fps',
        details: 'Alibaba video models do not support custom FPS.',
      });
    }
    if (options.n != null && options.n > 1) {
      warnings.push({
        type: 'unsupported',
        feature: 'n',
        details:
          'Alibaba video models only support generating 1 video per call.',
      });
    }

    // Step 1: Create task
    const { value: createResponse } = await postJsonToApi({
      url: `${this.config.baseURL}/api/v1/services/aigc/video-generation/video-synthesis`,
      headers: combineHeaders(
        await resolve(this.config.headers),
        options.headers,
        {
          'X-DashScope-Async': 'enable',
        },
      ),
      body: {
        model: this.modelId,
        input,
        parameters,
      },
      successfulResponseHandler: createJsonResponseHandler(
        alibabaVideoCreateTaskSchema,
      ),
      failedResponseHandler: alibabaVideoFailedResponseHandler,
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const taskId = createResponse.output?.task_id;
    if (!taskId) {
      throw new AISDKError({
        name: 'ALIBABA_VIDEO_GENERATION_ERROR',
        message: `No task_id returned from Alibaba API. Response: ${JSON.stringify(createResponse)}`,
      });
    }

    // Step 2: Poll for task completion
    const pollIntervalMs = alibabaOptions?.pollIntervalMs ?? 5000;
    const pollTimeoutMs = alibabaOptions?.pollTimeoutMs ?? 600000;
    const startTime = Date.now();
    let finalResponse: AlibabaVideoTaskStatusResponse | undefined;
    let responseHeaders: Record<string, string> | undefined;

    while (true) {
      await delay(pollIntervalMs, { abortSignal: options.abortSignal });

      if (Date.now() - startTime > pollTimeoutMs) {
        throw new AISDKError({
          name: 'ALIBABA_VIDEO_GENERATION_TIMEOUT',
          message: `Video generation timed out after ${pollTimeoutMs}ms`,
        });
      }

      const { value: statusResponse, responseHeaders: pollHeaders } =
        await getFromApi({
          url: `${this.config.baseURL}/api/v1/tasks/${taskId}`,
          validateUrl: false,
          headers: combineHeaders(
            await resolve(this.config.headers),
            options.headers,
          ),
          successfulResponseHandler: createJsonResponseHandler(
            alibabaVideoTaskStatusSchema,
          ),
          failedResponseHandler: alibabaVideoFailedResponseHandler,
          abortSignal: options.abortSignal,
          fetch: this.config.fetch,
        });

      responseHeaders = pollHeaders;
      const taskStatus = statusResponse.output?.task_status;

      if (taskStatus === 'SUCCEEDED') {
        finalResponse = statusResponse;
        break;
      }

      if (taskStatus === 'FAILED' || taskStatus === 'CANCELED') {
        throw new AISDKError({
          name: 'ALIBABA_VIDEO_GENERATION_FAILED',
          message: `Video generation ${taskStatus.toLowerCase()}. Task ID: ${taskId}. ${statusResponse.output?.message ?? ''}`,
        });
      }

      // Continue polling for PENDING, RUNNING, UNKNOWN statuses
    }

    const videoUrl = finalResponse?.output?.video_url;
    if (!videoUrl) {
      throw new AISDKError({
        name: 'ALIBABA_VIDEO_GENERATION_ERROR',
        message: `No video URL in response. Task ID: ${taskId}`,
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
        alibaba: {
          taskId,
          videoUrl,
          ...(finalResponse?.output?.actual_prompt
            ? { actualPrompt: finalResponse.output.actual_prompt }
            : {}),
          ...(finalResponse?.usage
            ? {
                usage: {
                  duration: finalResponse.usage.duration,
                  outputVideoDuration:
                    finalResponse.usage.output_video_duration,
                  resolution: finalResponse.usage.SR,
                  size: finalResponse.usage.size,
                },
              }
            : {}),
        },
      },
    };
  }
}
