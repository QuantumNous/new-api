import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const openaiFilesOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /*
       * Required by the OpenAI API, but optional here because
       * the SDK defaults to "assistants" — by far the most common
       * purpose when uploading files in this context.
       */
      purpose: z.string().optional(),
      expiresAfter: z.number().optional(),
    }),
  ),
);

export type OpenAIFilesOptions = InferSchema<typeof openaiFilesOptionsSchema>;
