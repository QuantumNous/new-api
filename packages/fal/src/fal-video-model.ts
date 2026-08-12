import {
  AISDKError,
  type Experimental_VideoModelV4,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertImageModelFileToDataUri,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  delay,
  getFromApi,
  isSameOrigin,
  parseProviderOptions,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { FalConfig } from './fal-config';
import { falErrorDataSchema, falFailedResponseHandler } from './fal-error';
import {
  falVideoModelOptionsSchema,
  type FalVideoModelOptions,
} from './fal-video-model-options';
import type { FalVideoModelId } from './fal-video-settings';

interface FalVideoModelConfig extends FalConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class FalVideoModel implements Experimental_VideoModelV4 {
  readonly specificationVersion = 'v4';
  readonly maxVideosPerCall = 1; // FAL video models support 1 video at a time

  get provider(): string {
    return this.config.provider;
  }

  private get normalizedModelId(): string {
    return this.modelId.replace(/^fal-ai\//, '').replace(/^fal\//, '');
  }

  constructor(
    readonly modelId: FalVideoModelId,
    private readonly config: FalVideoModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<Experimental_VideoModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<Experimental_VideoModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const warnings: SharedV4Warning[] = [];

    const falOptions = (await parseProviderOptions({
      provider: 'fal',
      providerOptions: options.providerOptions,
      schema: falVideoModelOptionsSchema,
    })) as FalVideoModelOptions | undefined;

    const body: Record<string, unknown> = {};

    if (options.prompt != null) {
      body.prompt = options.prompt;
    }

    if (options.image != null) {
      if (options.image.type === 'url') {
        body.image_url = options.image.url;
      } else {
        body.image_url = convertImageModelFileToDataUri(options.image);
      }
    }

    if (options.aspectRatio) {
      body.aspect_ratio = options.aspectRatio;
    }

    if (options.duration) {
      body.duration = `${options.duration}s`;
    }

    if (options.seed) {
      body.seed = options.seed;
    }

    if (falOptions != null) {
      const opts = falOptions;
      if (opts.loop !== undefined && opts.loop !== null) {
        body.loop = opts.loop;
      }
      if (opts.motionStrength !== undefined && opts.motionStrength !== null) {
        body.motion_strength = opts.motionStrength;
      }
      if (opts.resolution !== undefined && opts.resolution !== null) {
        body.resolution = opts.resolution;
      }
      if (opts.negativePrompt !== undefined && opts.negativePrompt !== null) {
        body.negative_prompt = opts.negativePrompt;
      }
      if (opts.promptOptimizer !== undefined && opts.promptOptimizer !== null) {
        body.prompt_optimizer = opts.promptOptimizer;
      }

      for (const [key, value] of Object.entries(opts)) {
        if (
          ![
            'loop',
            'motionStrength',
            'pollIntervalMs',
            'pollTimeoutMs',
            'resolution',
            'negativePrompt',
            'promptOptimizer',
          ].includes(key)
        ) {
          body[key] = value;
        }
      }
    }

    const submitUrl = this.config.url({
      path: `https://queue.fal.run/fal-ai/${this.normalizedModelId}`,
      modelId: this.modelId,
    });
    const { value: queueResponse } = await postJsonToApi({
      url: submitUrl,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: falFailedResponseHandler,
      successfulResponseHandler:
        createJsonResponseHandler(falJobResponseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const responseUrl = queueResponse.response_url;
    if (!responseUrl) {
      throw new AISDKError({
        name: 'FAL_VIDEO_GENERATION_ERROR',
        message: 'No response URL returned from queue endpoint',
      });
    }

    const pollIntervalMs = falOptions?.pollIntervalMs ?? 2000; // 2 seconds
    const pollTimeoutMs = falOptions?.pollTimeoutMs ?? 300000; // 5 minutes
    const startTime = Date.now();
    let response: FalVideoResponse;
    let responseHeaders: Record<string, string> | undefined;

    while (true) {
      try {
        const statusUrl = this.config.url({
          path: responseUrl,
          modelId: this.modelId,
        });
        const { value: statusResponse, responseHeaders: statusHeaders } =
          await getFromApi({
            url: statusUrl,
            // The status URL comes from the queue response; only send
            // credentials when it stays on the provider's own origin.
            headers: isSameOrigin(statusUrl, submitUrl)
              ? combineHeaders(this.config.headers?.(), options.headers)
              : undefined,
            failedResponseHandler: async ({
              response,
              url,
              requestBodyValues,
            }) => {
              const body = await response.clone().json();

              if (body.detail === 'Request is still in progress') {
                return {
                  value: new Error('Request is still in progress'),
                  rawValue: body,
                  responseHeaders: {},
                };
              }

              return createJsonErrorResponseHandler({
                errorSchema: falErrorDataSchema,
                errorToMessage: data => data.error.message,
              })({ response, url, requestBodyValues });
            },
            successfulResponseHandler: createJsonResponseHandler(
              falVideoResponseSchema,
            ),
            abortSignal: options.abortSignal,
            fetch: this.config.fetch,
          });

        response = statusResponse;
        responseHeaders = statusHeaders;
        break;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Request is still in progress'
        ) {
          // Continue polling
        } else {
          throw error;
        }
      }

      if (Date.now() - startTime > pollTimeoutMs) {
        throw new AISDKError({
          name: 'FAL_VIDEO_GENERATION_TIMEOUT',
          message: `Video generation request timed out after ${pollTimeoutMs}ms`,
        });
      }

      await delay(pollIntervalMs);

      if (options.abortSignal?.aborted) {
        throw new AISDKError({
          name: 'FAL_VIDEO_GENERATION_ABORTED',
          message: 'Video generation request was aborted',
        });
      }
    }

    const videoUrl = response.video?.url;

    if (!videoUrl || !response.video) {
      throw new AISDKError({
        name: 'FAL_VIDEO_GENERATION_ERROR',
        message: 'No video URL in response',
      });
    }

    return {
      videos: [
        {
          type: 'url',
          url: videoUrl,
          mediaType: response.video.content_type || 'video/mp4',
        },
      ],
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
      providerMetadata: {
        fal: {
          videos: [
            {
              url: videoUrl,
              width: response.video.width,
              height: response.video.height,
              duration: response.video.duration,
              fps: response.video.fps,
              contentType: response.video.content_type,
            },
          ],
          ...(response.seed !== undefined ? { seed: response.seed } : {}),
          ...(response.timings ? { timings: response.timings } : {}),
          ...(response.has_nsfw_concepts !== undefined
            ? { has_nsfw_concepts: response.has_nsfw_concepts }
            : {}),
          ...(response.prompt ? { prompt: response.prompt } : {}),
        },
      },
    };
  }
}

const falJobResponseSchema = z.object({
  request_id: z.string().nullish(),
  response_url: z.string().nullish(),
});

const falVideoResponseSchema = z.object({
  video: z
    .object({
      url: z.string(),
      width: z.number().nullish(),
      height: z.number().nullish(),
      duration: z.number().nullish(),
      fps: z.number().nullish(),
      content_type: z.string().nullish(),
    })
    .nullish(),
  seed: z.number().nullish(),
  timings: z
    .object({
      inference: z.number().nullish(),
    })
    .nullish(),
  has_nsfw_concepts: z.array(z.boolean()).nullish(),
  prompt: z.string().nullish(),
});

type FalVideoResponse = z.infer<typeof falVideoResponseSchema>;
