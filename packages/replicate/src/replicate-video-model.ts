import {
  AISDKError,
  type Experimental_VideoModelV4,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertImageModelFileToDataUri,
  createJsonResponseHandler,
  delay,
  getFromApi,
  isSameOrigin,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { replicateFailedResponseHandler } from './replicate-error';
import {
  replicateVideoModelOptionsSchema,
  type ReplicateVideoModelOptions,
} from './replicate-video-model-options';
import type { ReplicateVideoModelId } from './replicate-video-settings';

interface ReplicateVideoModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class ReplicateVideoModel implements Experimental_VideoModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxVideosPerCall = 1; // Replicate video models support 1 video at a time

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: ReplicateVideoModelId,
    private readonly config: ReplicateVideoModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<Experimental_VideoModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const warnings: SharedV4Warning[] = [];

    const replicateOptions = (await parseProviderOptions({
      provider: 'replicate',
      providerOptions: options.providerOptions,
      schema: replicateVideoModelOptionsSchema,
    })) as ReplicateVideoModelOptions | undefined;

    const [modelId, version] = this.modelId.split(':');
    const input: Record<string, unknown> = {};

    if (options.prompt != null) {
      input.prompt = options.prompt;
    }

    if (options.image != null) {
      if (options.image.type === 'url') {
        input.image = options.image.url;
      } else {
        input.image = convertImageModelFileToDataUri(options.image);
      }
    }

    if (options.aspectRatio) {
      input.aspect_ratio = options.aspectRatio;
    }

    if (options.resolution) {
      input.size = options.resolution;
    }

    if (options.duration) {
      input.duration = options.duration;
    }

    if (options.fps) {
      input.fps = options.fps;
    }

    if (options.seed) {
      input.seed = options.seed;
    }

    if (replicateOptions != null) {
      const opts = replicateOptions;
      if (opts.guidance_scale !== undefined && opts.guidance_scale !== null) {
        input.guidance_scale = opts.guidance_scale;
      }
      if (
        opts.num_inference_steps !== undefined &&
        opts.num_inference_steps !== null
      ) {
        input.num_inference_steps = opts.num_inference_steps;
      }
      if (
        opts.motion_bucket_id !== undefined &&
        opts.motion_bucket_id !== null
      ) {
        input.motion_bucket_id = opts.motion_bucket_id;
      }
      if (opts.cond_aug !== undefined && opts.cond_aug !== null) {
        input.cond_aug = opts.cond_aug;
      }
      if (opts.decoding_t !== undefined && opts.decoding_t !== null) {
        input.decoding_t = opts.decoding_t;
      }
      if (opts.video_length !== undefined && opts.video_length !== null) {
        input.video_length = opts.video_length;
      }
      if (opts.sizing_strategy !== undefined && opts.sizing_strategy !== null) {
        input.sizing_strategy = opts.sizing_strategy;
      }
      if (
        opts.frames_per_second !== undefined &&
        opts.frames_per_second !== null
      ) {
        input.frames_per_second = opts.frames_per_second;
      }
      if (
        opts.prompt_optimizer !== undefined &&
        opts.prompt_optimizer !== null
      ) {
        input.prompt_optimizer = opts.prompt_optimizer;
      }

      for (const [key, value] of Object.entries(opts)) {
        if (
          ![
            'pollIntervalMs',
            'pollTimeoutMs',
            'maxWaitTimeInSeconds',
            'guidance_scale',
            'num_inference_steps',
            'motion_bucket_id',
            'cond_aug',
            'decoding_t',
            'video_length',
            'sizing_strategy',
            'frames_per_second',
            'prompt_optimizer',
          ].includes(key)
        ) {
          input[key] = value;
        }
      }
    }

    const maxWaitTimeInSeconds = replicateOptions?.maxWaitTimeInSeconds;
    const preferHeader: Record<string, string> =
      maxWaitTimeInSeconds != null
        ? { prefer: `wait=${maxWaitTimeInSeconds}` }
        : { prefer: 'wait' };

    const predictionUrl =
      version != null
        ? `${this.config.baseURL}/predictions`
        : `${this.config.baseURL}/models/${modelId}/predictions`;

    const { value: prediction, responseHeaders } = await postJsonToApi({
      url: predictionUrl,
      headers: combineHeaders(
        await resolve(this.config.headers),
        options.headers,
        preferHeader,
      ),
      body: {
        input,
        ...(version != null ? { version } : {}),
      },
      successfulResponseHandler: createJsonResponseHandler(
        replicatePredictionSchema,
      ),
      failedResponseHandler: replicateFailedResponseHandler,
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finalPrediction = prediction;
    if (
      prediction.status === 'starting' ||
      prediction.status === 'processing'
    ) {
      const pollIntervalMs = replicateOptions?.pollIntervalMs ?? 2000; // 2 seconds
      const pollTimeoutMs = replicateOptions?.pollTimeoutMs ?? 300000; // 5 minutes

      const startTime = Date.now();

      while (
        finalPrediction.status === 'starting' ||
        finalPrediction.status === 'processing'
      ) {
        if (Date.now() - startTime > pollTimeoutMs) {
          throw new AISDKError({
            name: 'REPLICATE_VIDEO_GENERATION_TIMEOUT',
            message: `Video generation timed out after ${pollTimeoutMs}ms`,
          });
        }

        await delay(pollIntervalMs);

        if (options.abortSignal?.aborted) {
          throw new AISDKError({
            name: 'REPLICATE_VIDEO_GENERATION_ABORTED',
            message: 'Video generation request was aborted',
          });
        }

        const pollUrl = finalPrediction.urls.get;
        const { value: statusPrediction } = await getFromApi({
          url: pollUrl,
          // The polling URL comes from the provider response; only send
          // credentials when it stays on the provider's own origin.
          headers: isSameOrigin(pollUrl, this.config.baseURL)
            ? await resolve(this.config.headers)
            : undefined,
          successfulResponseHandler: createJsonResponseHandler(
            replicatePredictionSchema,
          ),
          failedResponseHandler: replicateFailedResponseHandler,
          abortSignal: options.abortSignal,
          fetch: this.config.fetch,
        });

        finalPrediction = statusPrediction;
      }
    }

    if (finalPrediction.status === 'failed') {
      throw new AISDKError({
        name: 'REPLICATE_VIDEO_GENERATION_FAILED',
        message: `Video generation failed: ${finalPrediction.error ?? 'Unknown error'}`,
      });
    }

    if (finalPrediction.status === 'canceled') {
      throw new AISDKError({
        name: 'REPLICATE_VIDEO_GENERATION_CANCELED',
        message: 'Video generation was canceled',
      });
    }

    const videoUrl = finalPrediction.output;
    if (!videoUrl) {
      throw new AISDKError({
        name: 'REPLICATE_VIDEO_GENERATION_ERROR',
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
        replicate: {
          videos: [
            {
              url: videoUrl,
            },
          ],
          predictionId: finalPrediction.id,
          metrics: finalPrediction.metrics,
        },
      },
    };
  }
}

const replicatePredictionSchema = z.object({
  id: z.string(),
  status: z.enum(['starting', 'processing', 'succeeded', 'failed', 'canceled']),
  output: z.string().nullish(),
  error: z.string().nullish(),
  urls: z.object({
    get: z.string(),
  }),
  metrics: z
    .object({
      predict_time: z.number().nullish(),
    })
    .nullish(),
});
