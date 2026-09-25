import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const alibabaErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().nullish(),
    type: z.string().nullish(),
  }),
});

export type AlibabaErrorData = z.infer<typeof alibabaErrorDataSchema>;

export const alibabaFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: alibabaErrorDataSchema,
  errorToMessage: data => data.error.message,
});
