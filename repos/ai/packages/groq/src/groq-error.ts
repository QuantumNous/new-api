import { z } from 'zod/v4';
import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';

export const groqErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
  }),
});

export type GroqErrorData = z.infer<typeof groqErrorDataSchema>;

export const groqFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: groqErrorDataSchema,
  errorToMessage: data => data.error.message,
});
