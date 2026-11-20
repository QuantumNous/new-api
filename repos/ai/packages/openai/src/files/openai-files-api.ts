import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const openaiFilesResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      id: z.string(),
      object: z.string().nullish(),
      bytes: z.number().nullish(),
      created_at: z.number().nullish(),
      filename: z.string().nullish(),
      purpose: z.string().nullish(),
      status: z.string().nullish(),
      expires_at: z.number().nullish(),
    }),
  ),
);
