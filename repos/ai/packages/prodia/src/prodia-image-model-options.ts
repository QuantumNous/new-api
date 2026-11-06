import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const stylePresets = [
  '3d-model',
  'analog-film',
  'anime',
  'cinematic',
  'comic-book',
  'digital-art',
  'enhance',
  'fantasy-art',
  'isometric',
  'line-art',
  'low-poly',
  'neon-punk',
  'origami',
  'photographic',
  'pixel-art',
  'texture',
  'craft-clay',
] as const;

export const prodiaImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * Amount of computational iterations to run. More is typically higher quality.
       */
      steps: z.number().int().min(1).max(4).optional(),
      /**
       * Width of the output image in pixels.
       */
      width: z.number().int().min(256).max(1920).optional(),
      /**
       * Height of the output image in pixels.
       */
      height: z.number().int().min(256).max(1920).optional(),
      /**
       * Apply a visual theme to your output image.
       */
      stylePreset: z.enum(stylePresets).optional(),
      /**
       * Augment the output with a LoRa model.
       */
      loras: z.array(z.string()).max(3).optional(),
      /**
       * When using JPEG output, return a progressive JPEG.
       */
      progressive: z.boolean().optional(),
    }),
  ),
);

export type ProdiaImageModelOptions = InferSchema<
  typeof prodiaImageModelOptionsSchema
>;
