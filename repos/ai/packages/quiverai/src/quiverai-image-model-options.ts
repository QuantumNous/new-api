import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Provider options schema for QuiverAI image generation.
 *
 * @see https://quiver.ai/
 */
export const quiveraiImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * The operation to perform. Defaults to `generate`.
       *
       * - `generate`: Text-to-SVG generation. Requires `prompt`.
       * - `vectorize`: Convert an input raster image into an SVG. Requires a
       *   single image in `prompt.images` / `files`.
       */
      operation: z.enum(['generate', 'vectorize']).optional(),

      /**
       * Extra style guidance for prompt-based generation.
       */
      instructions: z.string().min(1).optional(),

      /**
       * Sampling temperature (0-2).
       */
      temperature: z.number().min(0).max(2).optional(),

      /**
       * Nucleus sampling top-p (0-1).
       */
      topP: z.number().min(0).max(1).optional(),

      /**
       * Presence penalty (-2 to 2).
       */
      presencePenalty: z.number().min(-2).max(2).nullable().optional(),

      /**
       * Maximum number of output tokens (1 - 131072).
       */
      maxOutputTokens: z.number().int().min(1).max(131072).optional(),

      /**
       * Whether to auto-crop the input image before vectorization.
       * Only used when `operation` is `vectorize`.
       */
      autoCrop: z.boolean().optional(),

      /**
       * Target canvas size in pixels for vectorization (128 - 4096).
       * Only used when `operation` is `vectorize`.
       */
      targetSize: z.number().int().min(128).max(4096).optional(),
    }),
  ),
);

export type QuiverAIImageModelOptions = InferSchema<
  typeof quiveraiImageModelOptionsSchema
>;
