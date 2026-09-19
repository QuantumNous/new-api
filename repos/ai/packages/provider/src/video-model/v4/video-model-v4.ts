import type { VideoModelV4CallOptions } from './video-model-v4-call-options';
import type { VideoModelV4Result } from './video-model-v4-result';

type GetMaxVideosPerCallFunction = (options: {
  modelId: string;
}) => PromiseLike<number | undefined> | number | undefined;

/**
 * Video generation model specification version 3.
 */
export type VideoModelV4 = {
  /**
   * The video model must specify which video model interface
   * version it implements. This will allow us to evolve the video
   * model interface and retain backwards compatibility. The different
   * implementation versions can be handled as a discriminated union
   * on our side.
   */
  readonly specificationVersion: 'v4';

  /**
   * Name of the provider for logging purposes.
   */
  readonly provider: string;

  /**
   * Provider-specific model ID for logging purposes.
   */
  readonly modelId: string;

  /**
   * Limit of how many videos can be generated in a single API call.
   * Can be set to a number for a fixed limit, to undefined to use
   * the global limit, or a function that returns a number or undefined,
   * optionally as a promise.
   *
   * Most video models only support generating 1 video at a time due to
   * computational cost. Default is typically 1.
   */
  readonly maxVideosPerCall: number | undefined | GetMaxVideosPerCallFunction;

  /**
   * Generates an array of videos.
   */
  doGenerate(options: VideoModelV4CallOptions): PromiseLike<VideoModelV4Result>;
};
