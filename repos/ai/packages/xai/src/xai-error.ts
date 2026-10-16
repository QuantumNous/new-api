import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const chatCompletionsErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().nullish(),
    param: z.any().nullish(),
    code: z.union([z.string(), z.number()]).nullish(),
  }),
});

const responsesErrorSchema = z.object({
  code: z.string(),
  error: z.string(),
});

export const xaiErrorDataSchema = z.union([
  chatCompletionsErrorSchema,
  responsesErrorSchema,
]);

export type XaiErrorData = z.infer<typeof xaiErrorDataSchema>;

export const xaiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: xaiErrorDataSchema,
  errorToMessage: data =>
    'code' in data ? `${data.code}: ${data.error}` : data.error.message,
});
