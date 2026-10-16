import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export type ByteDanceVideoModelOptions = {
  watermark?: boolean | null;
  generateAudio?: boolean | null;
  cameraFixed?: boolean | null;
  returnLastFrame?: boolean | null;
  serviceTier?: 'default' | 'flex' | null;
  draft?: boolean | null;
  lastFrameImage?: string | null;
  referenceImages?: string[] | null;
  referenceVideos?: string[] | null;
  referenceAudio?: string[] | null;
  pollIntervalMs?: number | null;
  pollTimeoutMs?: number | null;
  [key: string]: unknown;
};

export const byteDanceVideoModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      watermark: z.boolean().nullish(),
      generateAudio: z.boolean().nullish(),
      cameraFixed: z.boolean().nullish(),
      returnLastFrame: z.boolean().nullish(),
      serviceTier: z.enum(['default', 'flex']).nullish(),
      draft: z.boolean().nullish(),
      lastFrameImage: z.string().nullish(),
      referenceImages: z.array(z.string()).nullish(),
      referenceVideos: z.array(z.string()).nullish(),
      referenceAudio: z.array(z.string()).nullish(),
      pollIntervalMs: z.number().positive().nullish(),
      pollTimeoutMs: z.number().positive().nullish(),
    }),
  ),
);
