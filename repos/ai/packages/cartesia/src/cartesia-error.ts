import { z } from 'zod/v4';
import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';

export const cartesiaErrorDataSchema = z.object({
  error_code: z.string().nullish(),
  title: z.string(),
  message: z.string(),
  request_id: z.string(),
  doc_url: z.string().optional(),
});

export type CartesiaErrorData = z.infer<typeof cartesiaErrorDataSchema>;

export const cartesiaFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: cartesiaErrorDataSchema,
  errorToMessage: data => `${data.title}: ${data.message}`,
});
