import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const huggingfaceErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.string().optional(),
  }),
});

export type HuggingFaceErrorData = z.infer<typeof huggingfaceErrorDataSchema>;

export const huggingfaceFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: huggingfaceErrorDataSchema,
  errorToMessage: data => data.error.message,
});
