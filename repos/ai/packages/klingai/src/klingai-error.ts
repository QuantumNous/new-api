import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const klingaiErrorDataSchema = z.object({
  code: z.number(),
  message: z.string(),
});

export type KlingAIErrorData = z.infer<typeof klingaiErrorDataSchema>;

export const klingaiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: klingaiErrorDataSchema,
  errorToMessage: data => data.message,
});
