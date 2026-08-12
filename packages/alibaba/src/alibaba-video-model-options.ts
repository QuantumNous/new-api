import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export type AlibabaVideoModelOptions = {
  /** Negative prompt to specify what to avoid (max 500 chars). */
  negativePrompt?: string | null;
  /** URL to audio file for audio-video sync (WAV/MP3, 3-30s, max 15MB). */
  audioUrl?: string | null;
  /** Enable prompt extension/rewriting for better generation. Defaults to true. */
  promptExtend?: boolean | null;
  /** Shot type: 'single' for single-shot or 'multi' for multi-shot narrative. */
  shotType?: 'single' | 'multi' | null;
  /** Whether to add watermark to generated video. Defaults to false. */
  watermark?: boolean | null;
  /** Enable audio generation (for I2V/R2V models). */
  audio?: boolean | null;
  /**
   * Reference URLs for reference-to-video mode.
   * Array of URLs to images (0-5) and/or videos (0-3), max 5 total.
   * Use character identifiers (character1, character2) in prompts to reference them.
   */
  referenceUrls?: string[] | null;
  /** Polling interval in milliseconds. Defaults to 5000 (5 seconds). */
  pollIntervalMs?: number | null;
  /** Maximum wait time in milliseconds for video generation. Defaults to 600000 (10 minutes). */
  pollTimeoutMs?: number | null;
  [key: string]: unknown;
};

export const alibabaVideoModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      negativePrompt: z.string().nullish(),
      audioUrl: z.string().nullish(),
      promptExtend: z.boolean().nullish(),
      shotType: z.enum(['single', 'multi']).nullish(),
      watermark: z.boolean().nullish(),
      audio: z.boolean().nullish(),
      referenceUrls: z.array(z.string()).nullish(),
      pollIntervalMs: z.number().positive().nullish(),
      pollTimeoutMs: z.number().positive().nullish(),
    }),
  ),
);
