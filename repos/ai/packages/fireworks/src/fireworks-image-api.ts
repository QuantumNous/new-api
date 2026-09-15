import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// Schema for async submit response
export const asyncSubmitResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      request_id: z.string(),
    }),
  ),
);

// Schema for async poll response
export const asyncPollResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      id: z.string(),
      status: z.string(),
      result: z
        .object({
          sample: z.string().optional(),
        })
        .nullable(),
    }),
  ),
);
