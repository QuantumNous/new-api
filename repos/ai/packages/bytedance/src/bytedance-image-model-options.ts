import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export type ByteDanceImageModelOptions = {
  /**
   * Whether to add an "AI generated" watermark to the bottom-right corner of
   * the output image.
   */
  watermark?: boolean | null;

  /**
   * Format of the generated image file. Supported by `seedream-5-0` and
   * `dola-seedream-5-0-pro`; `seedream-4-5` / `seedream-4-0` always return
   * `jpeg`.
   */
  outputFormat?: 'png' | 'jpeg' | null;

  /**
   * A resolution level (e.g. `1K`, `2K`, `3K`, `4K`) as an alternative to
   * passing pixel dimensions via the top-level `size` parameter. When set, this
   * overrides the top-level `size`. Available levels vary by model.
   */
  size?: string | null;

  /**
   * Set to `'auto'` to generate a batch of related images (e.g. storyboards or
   * brand visuals). Defaults to `'disabled'` (single image).
   */
  sequentialImageGeneration?: 'auto' | 'disabled' | null;

  /**
   * Maximum number of images to generate when `sequentialImageGeneration` is
   * `'auto'`. The number of input reference images plus generated images must
   * not exceed the model's limit.
   */
  maxImages?: number | null;

  /**
   * Prompt optimization mode. `seedream-4-0` supports both `'standard'` and
   * `'fast'`; other models support `'standard'` only.
   */
  optimizePromptMode?: 'standard' | 'fast' | null;

  [key: string]: unknown;
};

export const byteDanceImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      watermark: z.boolean().nullish(),
      outputFormat: z.enum(['png', 'jpeg']).nullish(),
      size: z.string().nullish(),
      sequentialImageGeneration: z.enum(['auto', 'disabled']).nullish(),
      maxImages: z.number().int().positive().nullish(),
      optimizePromptMode: z.enum(['standard', 'fast']).nullish(),
    }),
  ),
);
