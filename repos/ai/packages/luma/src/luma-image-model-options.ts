import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Provider options schema for Luma image generation.
 *
 * @see https://docs.lumalabs.ai/docs/image-generation
 */
export const lumaImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      /**
       * The type of image reference to use when providing input images.
       * - `image`: Guide generation using reference images (up to 4). Default.
       * - `style`: Apply a specific style from reference image(s).
       * - `character`: Create consistent characters from reference images (up to 4).
       * - `modify_image`: Transform a single input image with prompt guidance.
       */
      referenceType: z
        .enum(['image', 'style', 'character', 'modify_image'])
        .nullish(),

      /**
       * Per-image configuration array. Each entry corresponds to an image in `prompt.images`.
       * Allows setting individual weights for each reference image.
       */
      images: z
        .array(
          z.object({
            /**
             * The weight of this image's influence on the generation.
             * - For `image`: Higher weight = closer to reference (default: 0.85)
             * - For `style`: Higher weight = stronger style influence (default: 0.8)
             * - For `modify_image`: Higher weight = closer to input, lower = more creative (default: 1.0)
             */
            weight: z.number().min(0).max(1).nullish(),

            /**
             * The identity name for character references.
             * Used with `character` to specify which identity group the image belongs to.
             * Luma supports multiple identities (e.g., 'identity0', 'identity1') for generating
             * images with multiple consistent characters.
             * Default: 'identity0'
             */
            id: z.string().nullish(),
          }),
        )
        .nullish(),

      /**
       * Override the polling interval in milliseconds (default 500).
       */
      pollIntervalMillis: z.number().nullish(),

      /**
       * Override the maximum number of polling attempts (default 120).
       */
      maxPollAttempts: z.number().nullish(),
    }),
  ),
);

export type LumaImageModelOptions = InferSchema<
  typeof lumaImageModelOptionsSchema
>;
