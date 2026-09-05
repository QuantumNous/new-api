import {
  AISDKError,
  NoSuchModelError,
  type Experimental_VideoModelV4,
  type Experimental_VideoModelV4File,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertUint8ArrayToBase64,
  createJsonResponseHandler,
  delay,
  getFromApi,
  getTopLevelMediaType,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { klingaiFailedResponseHandler } from './klingai-error';
import {
  klingaiVideoModelOptionsSchema,
  type KlingAIVideoModelOptions,
} from './klingai-video-model-options';
import type { KlingAIVideoModelId } from './klingai-video-settings';

type KlingAIVideoMode = 't2v' | 'i2v' | 'mi2v' | 'motion-control';

function fileToImageString(file: Experimental_VideoModelV4File): string {
  if (file.type === 'url') {
    return file.url;
  }
  return typeof file.data === 'string'
    ? file.data
    : convertUint8ArrayToBase64(file.data);
}

/**
 * KlingAI does not support video reference inputs. This detects whether a file
 * is a video so it can be guarded against and excluded.
 */
const isVideoFile = (file: Experimental_VideoModelV4File): boolean =>
  file.mediaType != null && getTopLevelMediaType(file.mediaType) === 'video';

function getReferenceImages(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  warnings: SharedV4Warning[],
): Array<Experimental_VideoModelV4File> | undefined {
  if (options.frameImages != null && options.frameImages.length > 0) {
    return undefined;
  }

  if (options.inputReferences == null || options.inputReferences.length === 0) {
    return undefined;
  }

  const imageReferences = options.inputReferences.filter(reference => {
    if (isVideoFile(reference)) {
      warnings.push({
        type: 'unsupported',
        feature: 'inputReferences',
        details:
          'KlingAI does not support video reference inputs; the video ' +
          'reference was ignored.',
      });
      return false;
    }
    return true;
  });

  return imageReferences.length > 0 ? imageReferences : undefined;
}

function getFirstFrameImage(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
): Experimental_VideoModelV4File | undefined {
  return options.frameImages?.find(frame => frame.frameType === 'first_frame')
    ?.image;
}

function resolveStartImage(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  warnings: SharedV4Warning[],
): Experimental_VideoModelV4File | undefined {
  const startImage = getFirstFrameImage(options) ?? options.image;

  if (startImage != null && isVideoFile(startImage)) {
    warnings.push({
      type: 'unsupported',
      feature: 'frameImages',
      details:
        'KlingAI does not accept video as a frame image; it was ignored.',
    });
    return undefined;
  }

  return startImage;
}

function resolveImageTail(
  options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  klingaiOptions: KlingAIVideoModelOptions | undefined,
  warnings: SharedV4Warning[],
): string | undefined {
  const lastFrame = options.frameImages?.find(
    frame => frame.frameType === 'last_frame',
  )?.image;

  if (lastFrame != null) {
    if (isVideoFile(lastFrame)) {
      warnings.push({
        type: 'unsupported',
        feature: 'frameImages',
        details:
          'KlingAI does not accept video as a frame image; it was ignored.',
      });
      return undefined;
    }
    return fileToImageString(lastFrame);
  }

  return klingaiOptions?.imageTail ?? undefined;
}

/**
 * Detects the video generation mode from the model ID suffix.
 */
function detectMode(modelId: string): KlingAIVideoMode {
  if (modelId.endsWith('-t2v')) return 't2v';
  if (modelId.endsWith('-i2v')) return 'i2v';
  if (modelId.endsWith('-motion-control')) return 'motion-control';
  throw new NoSuchModelError({ modelId, modelType: 'videoModel' });
}

/**
 * Maps video generation mode to the KlingAI API endpoint path.
 */
const modeEndpointMap: Record<KlingAIVideoMode, string> = {
  t2v: '/v1/videos/text2video',
  i2v: '/v1/videos/image2video',
  mi2v: '/v1/videos/multi-image2video',
  'motion-control': '/v1/videos/motion-control',
};

/**
 * Derives the KlingAI API `model_name` from the SDK model ID.
 * Strips the mode suffix and converts dots to hyphens.
 *
 * Examples:
 * - 'kling-v2.6-t2v' → 'kling-v2-6'
 * - 'kling-v2.1-master-i2v' → 'kling-v2-1-master'
 * - 'kling-v1-t2v' → 'kling-v1'
 * - 'kling-v3.0-t2v' → 'kling-v3'
 */
function getApiModelName(modelId: string, mode: KlingAIVideoMode): string {
  const suffix =
    mode === 'motion-control'
      ? '-motion-control'
      : mode === 'mi2v'
        ? '-i2v'
        : `-${mode}`;
  const baseName = modelId.slice(0, -suffix.length);
  return baseName.replace(/\.0$/, '').replace(/\./g, '-');
}

/**
 * Known provider option keys that are handled explicitly and should not be
 * passed through to the API body.
 */
const HANDLED_PROVIDER_OPTIONS = new Set([
  'mode',
  'pollIntervalMs',
  'pollTimeoutMs',
  'negativePrompt',
  'sound',
  'cfgScale',
  'cameraControl',
  'multiShot',
  'shotType',
  'multiPrompt',
  'elementList',
  'voiceList',
  'imageTail',
  'staticMask',
  'dynamicMasks',
  'videoUrl',
  'characterOrientation',
  'keepOriginalSound',
  'watermarkEnabled',
]);

interface KlingAIVideoModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class KlingAIVideoModel implements Experimental_VideoModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxVideosPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: KlingAIVideoModelId,
    private readonly config: KlingAIVideoModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<Experimental_VideoModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const warnings: SharedV4Warning[] = [];
    const mode = detectMode(this.modelId);

    const klingaiOptions = (await parseProviderOptions({
      provider: 'klingai',
      providerOptions: options.providerOptions,
      schema: klingaiVideoModelOptionsSchema,
    })) as KlingAIVideoModelOptions | undefined;

    const referenceImages = getReferenceImages(options, warnings);
    const effectiveMode: KlingAIVideoMode =
      mode === 'i2v' && referenceImages != null ? 'mi2v' : mode;

    let body: Record<string, unknown>;

    if (effectiveMode === 'motion-control') {
      body = this.buildMotionControlBody(options, klingaiOptions, warnings);
    } else if (effectiveMode === 't2v') {
      body = this.buildT2VBody(options, klingaiOptions, warnings);
    } else if (effectiveMode === 'mi2v') {
      body = this.buildMultiImageBody(
        options,
        klingaiOptions,
        referenceImages!,
        warnings,
      );
    } else {
      body = this.buildI2VBody(options, klingaiOptions, warnings);
    }

    if (referenceImages != null && effectiveMode !== 'mi2v') {
      warnings.push({
        type: 'unsupported',
        feature: 'inputReferences',
        details:
          'KlingAI only supports inputReferences (reference-to-video) on ' +
          'image-to-video models. The reference images were ignored.',
      });
    }

    // Warn about universally unsupported standard options
    if (options.resolution) {
      warnings.push({
        type: 'unsupported',
        feature: 'resolution',
        details: 'KlingAI video models do not support the resolution option.',
      });
    }

    if (options.seed) {
      warnings.push({
        type: 'unsupported',
        feature: 'seed',
        details:
          'KlingAI video models do not support seed for deterministic generation.',
      });
    }

    if (options.fps) {
      warnings.push({
        type: 'unsupported',
        feature: 'fps',
        details: 'KlingAI video models do not support custom FPS.',
      });
    }

    if (options.n != null && options.n > 1) {
      warnings.push({
        type: 'unsupported',
        feature: 'n',
        details:
          'KlingAI video models do not support generating multiple videos per call. ' +
          'Only 1 video will be generated.',
      });
    }

    const endpointPath = modeEndpointMap[effectiveMode];

    // Step 1: Create the task
    const { value: createResponse, responseHeaders: createHeaders } =
      await postJsonToApi({
        url: `${this.config.baseURL}${endpointPath}`,
        headers: combineHeaders(
          await resolve(this.config.headers),
          options.headers,
        ),
        body,
        successfulResponseHandler: createJsonResponseHandler(
          klingaiCreateTaskSchema,
        ),
        failedResponseHandler: klingaiFailedResponseHandler,
        abortSignal: options.abortSignal,
        fetch: this.config.fetch,
      });

    const taskId = createResponse.data?.task_id;
    if (!taskId) {
      throw new AISDKError({
        name: 'KLINGAI_VIDEO_GENERATION_ERROR',
        message: `No task_id returned from KlingAI API. Response: ${JSON.stringify(createResponse)}`,
      });
    }

    // Step 2: Poll for task completion
    const pollIntervalMs = klingaiOptions?.pollIntervalMs ?? 5000; // 5 seconds
    const pollTimeoutMs = klingaiOptions?.pollTimeoutMs ?? 600000; // 10 minutes
    const startTime = Date.now();
    let finalResponse: KlingAITaskResponse | undefined;
    let responseHeaders: Record<string, string> | undefined = createHeaders;

    while (true) {
      await delay(pollIntervalMs, { abortSignal: options.abortSignal });

      if (Date.now() - startTime > pollTimeoutMs) {
        throw new AISDKError({
          name: 'KLINGAI_VIDEO_GENERATION_TIMEOUT',
          message: `Video generation timed out after ${pollTimeoutMs}ms`,
        });
      }

      const { value: statusResponse, responseHeaders: pollHeaders } =
        await getFromApi({
          url: `${this.config.baseURL}${endpointPath}/${taskId}`,
          validateUrl: false,
          headers: combineHeaders(
            await resolve(this.config.headers),
            options.headers,
          ),
          successfulResponseHandler: createJsonResponseHandler(
            klingaiTaskStatusSchema,
          ),
          failedResponseHandler: klingaiFailedResponseHandler,
          abortSignal: options.abortSignal,
          fetch: this.config.fetch,
        });

      responseHeaders = pollHeaders;
      const taskStatus = statusResponse.data?.task_status;

      if (taskStatus === 'succeed') {
        finalResponse = statusResponse;
        break;
      }

      if (taskStatus === 'failed') {
        throw new AISDKError({
          name: 'KLINGAI_VIDEO_GENERATION_FAILED',
          message: `Video generation failed: ${statusResponse.data?.task_status_msg ?? 'Unknown error'}`,
        });
      }

      // Continue polling for 'submitted' and 'processing' statuses
    }

    if (!finalResponse?.data?.task_result?.videos?.length) {
      throw new AISDKError({
        name: 'KLINGAI_VIDEO_GENERATION_ERROR',
        message: `No videos in response. Response: ${JSON.stringify(finalResponse)}`,
      });
    }

    const videos: Array<{ type: 'url'; url: string; mediaType: string }> = [];
    const videoMetadata: Array<{
      id: string;
      url: string;
      watermarkUrl?: string;
      duration?: string;
    }> = [];

    for (const video of finalResponse.data.task_result.videos) {
      if (video.url) {
        videos.push({
          type: 'url',
          url: video.url,
          mediaType: 'video/mp4',
        });
        videoMetadata.push({
          id: video.id ?? '',
          url: video.url,
          ...(video.watermark_url ? { watermarkUrl: video.watermark_url } : {}),
          ...(video.duration ? { duration: video.duration } : {}),
        });
      }
    }

    if (videos.length === 0) {
      throw new AISDKError({
        name: 'KLINGAI_VIDEO_GENERATION_ERROR',
        message: 'No valid video URLs in response',
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
      providerMetadata: {
        klingai: {
          taskId,
          videos: videoMetadata,
        },
      },
    };
  }

  private buildT2VBody(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
    klingaiOptions: KlingAIVideoModelOptions | undefined,
    warnings: SharedV4Warning[],
  ): Record<string, unknown> {
    const mode = 't2v' as const;
    const body: Record<string, unknown> = {
      model_name: getApiModelName(this.modelId, mode),
    };

    if (options.prompt != null) {
      body.prompt = options.prompt;
    }

    if (klingaiOptions?.negativePrompt != null) {
      body.negative_prompt = klingaiOptions.negativePrompt;
    }

    const sound =
      options.generateAudio != null
        ? options.generateAudio
          ? 'on'
          : 'off'
        : klingaiOptions?.sound;
    if (sound != null) {
      body.sound = sound;
    }

    if (klingaiOptions?.cfgScale != null) {
      body.cfg_scale = klingaiOptions.cfgScale;
    }

    if (klingaiOptions?.mode != null) {
      body.mode = klingaiOptions.mode;
    }

    if (klingaiOptions?.cameraControl != null) {
      body.camera_control = klingaiOptions.cameraControl;
    }

    // Map standard SDK aspectRatio (same format as KlingAI API)
    if (options.aspectRatio != null) {
      body.aspect_ratio = options.aspectRatio;
    }

    // Map standard SDK duration (number → string)
    if (options.duration != null) {
      body.duration = String(options.duration);
    }

    // v3.0 multi-shot
    if (klingaiOptions?.multiShot != null) {
      body.multi_shot = klingaiOptions.multiShot;
    }

    if (klingaiOptions?.shotType != null) {
      body.shot_type = klingaiOptions.shotType;
    }

    if (klingaiOptions?.multiPrompt != null) {
      body.multi_prompt = klingaiOptions.multiPrompt;
    }

    // v3.0 voice control
    if (klingaiOptions?.voiceList != null) {
      body.voice_list = klingaiOptions.voiceList;
    }

    if (klingaiOptions?.watermarkEnabled != null) {
      body.watermark_info = { enabled: klingaiOptions.watermarkEnabled };
    }

    // Image is not supported for T2V
    if (resolveStartImage(options, warnings) != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'image',
        details:
          'KlingAI text-to-video does not support image input. Use an image-to-video model instead.',
      });
    }

    this.addPassthroughOptions(body, klingaiOptions);

    return body;
  }

  private buildI2VBody(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
    klingaiOptions: KlingAIVideoModelOptions | undefined,
    warnings: SharedV4Warning[],
  ): Record<string, unknown> {
    const mode = 'i2v' as const;
    const body: Record<string, unknown> = {
      model_name: getApiModelName(this.modelId, mode),
    };

    if (options.prompt != null) {
      body.prompt = options.prompt;
    }

    const startImage = resolveStartImage(options, warnings);
    if (startImage != null) {
      body.image = fileToImageString(startImage);
    }

    // End frame image: prefer top-level frameImages (last_frame), fall back to
    // providerOptions.klingai.imageTail.
    const imageTail = resolveImageTail(options, klingaiOptions, warnings);
    if (imageTail != null) {
      body.image_tail = imageTail;
    }

    if (klingaiOptions?.negativePrompt != null) {
      body.negative_prompt = klingaiOptions.negativePrompt;
    }

    const sound =
      options.generateAudio != null
        ? options.generateAudio
          ? 'on'
          : 'off'
        : klingaiOptions?.sound;
    if (sound != null) {
      body.sound = sound;
    }

    if (klingaiOptions?.cfgScale != null) {
      body.cfg_scale = klingaiOptions.cfgScale;
    }

    if (klingaiOptions?.mode != null) {
      body.mode = klingaiOptions.mode;
    }

    if (klingaiOptions?.cameraControl != null) {
      body.camera_control = klingaiOptions.cameraControl;
    }

    if (klingaiOptions?.staticMask != null) {
      body.static_mask = klingaiOptions.staticMask;
    }

    if (klingaiOptions?.dynamicMasks != null) {
      body.dynamic_masks = klingaiOptions.dynamicMasks;
    }

    // v3.0 multi-shot
    if (klingaiOptions?.multiShot != null) {
      body.multi_shot = klingaiOptions.multiShot;
    }

    if (klingaiOptions?.shotType != null) {
      body.shot_type = klingaiOptions.shotType;
    }

    if (klingaiOptions?.multiPrompt != null) {
      body.multi_prompt = klingaiOptions.multiPrompt;
    }

    // v3.0 element control (I2V only)
    if (klingaiOptions?.elementList != null) {
      body.element_list = klingaiOptions.elementList;
    }

    // v3.0 voice control
    if (klingaiOptions?.voiceList != null) {
      body.voice_list = klingaiOptions.voiceList;
    }

    if (klingaiOptions?.watermarkEnabled != null) {
      body.watermark_info = { enabled: klingaiOptions.watermarkEnabled };
    }

    // Map standard SDK duration (number → string)
    if (options.duration != null) {
      body.duration = String(options.duration);
    }

    // aspectRatio is not supported for I2V (determined by input image)
    if (options.aspectRatio != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'aspectRatio',
        details:
          'KlingAI image-to-video does not support aspectRatio. ' +
          'The output dimensions are determined by the input image.',
      });
    }

    this.addPassthroughOptions(body, klingaiOptions);

    return body;
  }

  private buildMultiImageBody(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
    klingaiOptions: KlingAIVideoModelOptions | undefined,
    referenceImages: Array<Experimental_VideoModelV4File>,
    warnings: SharedV4Warning[],
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model_name: getApiModelName(this.modelId, 'mi2v'),
      image_list: referenceImages.map(image => ({
        image: fileToImageString(image),
      })),
    };

    if (options.prompt != null) {
      body.prompt = options.prompt;
    }

    if (klingaiOptions?.negativePrompt != null) {
      body.negative_prompt = klingaiOptions.negativePrompt;
    }

    if (klingaiOptions?.cfgScale != null) {
      body.cfg_scale = klingaiOptions.cfgScale;
    }

    if (klingaiOptions?.mode != null) {
      body.mode = klingaiOptions.mode;
    }

    if (options.aspectRatio != null) {
      body.aspect_ratio = options.aspectRatio;
    }

    if (options.duration != null) {
      body.duration = String(options.duration);
    }

    if (klingaiOptions?.watermarkEnabled != null) {
      body.watermark_info = { enabled: klingaiOptions.watermarkEnabled };
    }

    if (resolveStartImage(options, warnings) != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'image',
        details:
          'KlingAI reference-to-video does not support a separate start frame. ' +
          'Provide all guidance images via inputReferences instead.',
      });
    }

    if (resolveImageTail(options, klingaiOptions, warnings) != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'frameImages',
        details:
          'KlingAI reference-to-video does not support a last frame (image_tail). ' +
          'Provide all guidance images via inputReferences instead.',
      });
    }

    this.addPassthroughOptions(body, klingaiOptions);

    return body;
  }

  private buildMotionControlBody(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
    klingaiOptions: KlingAIVideoModelOptions | undefined,
    warnings: SharedV4Warning[],
  ): Record<string, unknown> {
    if (
      !klingaiOptions?.videoUrl ||
      !klingaiOptions?.characterOrientation ||
      !klingaiOptions?.mode
    ) {
      throw new AISDKError({
        name: 'KLINGAI_VIDEO_MISSING_OPTIONS',
        message:
          'KlingAI Motion Control requires providerOptions.klingai with videoUrl, characterOrientation, and mode.',
      });
    }

    const mode = 'motion-control' as const;
    const body: Record<string, unknown> = {
      model_name: getApiModelName(this.modelId, mode),
      video_url: klingaiOptions.videoUrl,
      character_orientation: klingaiOptions.characterOrientation,
      mode: klingaiOptions.mode,
    };

    if (options.prompt != null) {
      body.prompt = options.prompt;
    }

    const startImage = resolveStartImage(options, warnings);
    if (startImage != null) {
      body.image_url = fileToImageString(startImage);
    }

    if (klingaiOptions.keepOriginalSound != null) {
      body.keep_original_sound = klingaiOptions.keepOriginalSound;
    }

    if (klingaiOptions.watermarkEnabled != null) {
      body.watermark_info = { enabled: klingaiOptions.watermarkEnabled };
    }

    // v3.0 element control
    if (klingaiOptions.elementList != null) {
      body.element_list = klingaiOptions.elementList;
    }

    // Warn about unsupported standard options for motion control
    if (options.aspectRatio) {
      warnings.push({
        type: 'unsupported',
        feature: 'aspectRatio',
        details:
          'KlingAI Motion Control does not support aspectRatio. ' +
          'The output dimensions are determined by the reference image/video.',
      });
    }

    if (options.duration) {
      warnings.push({
        type: 'unsupported',
        feature: 'duration',
        details:
          'KlingAI Motion Control does not support custom duration. ' +
          'The output duration matches the reference video duration.',
      });
    }

    this.addPassthroughOptions(body, klingaiOptions);

    return body;
  }

  private addPassthroughOptions(
    body: Record<string, unknown>,
    klingaiOptions: KlingAIVideoModelOptions | undefined,
  ): void {
    if (!klingaiOptions) return;
    for (const [key, value] of Object.entries(klingaiOptions)) {
      if (!HANDLED_PROVIDER_OPTIONS.has(key)) {
        body[key] = value;
      }
    }
  }
}

// Response schema for task creation (POST)
const klingaiCreateTaskSchema = z.object({
  code: z.number(),
  message: z.string(),
  request_id: z.string().nullish(),
  data: z
    .object({
      task_id: z.string(),
      task_status: z.string().nullish(),
      task_info: z
        .object({
          external_task_id: z.string().nullish(),
        })
        .nullish(),
      created_at: z.number().nullish(),
      updated_at: z.number().nullish(),
    })
    .nullish(),
});

// Response schema for task status query (GET)
const klingaiTaskStatusSchema = z.object({
  code: z.number(),
  message: z.string(),
  request_id: z.string().nullish(),
  data: z
    .object({
      task_id: z.string(),
      task_status: z.string(),
      task_status_msg: z.string().nullish(),
      task_info: z
        .object({
          external_task_id: z.string().nullish(),
        })
        .nullish(),
      watermark_info: z
        .object({
          enabled: z.boolean().nullish(),
        })
        .nullish(),
      final_unit_deduction: z.string().nullish(),
      created_at: z.number().nullish(),
      updated_at: z.number().nullish(),
      task_result: z
        .object({
          videos: z
            .array(
              z.object({
                id: z.string().nullish(),
                url: z.string().nullish(),
                watermark_url: z.string().nullish(),
                duration: z.string().nullish(),
              }),
            )
            .nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

type KlingAITaskResponse = z.infer<typeof klingaiTaskStatusSchema>;
