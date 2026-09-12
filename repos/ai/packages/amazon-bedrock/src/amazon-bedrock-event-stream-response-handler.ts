import { EmptyResponseBodyError } from '@ai-sdk/provider';
import {
  safeParseJSON,
  extractResponseHeaders,
  safeValidateTypes,
  type ParseResult,
  type ResponseHandler,
} from '@ai-sdk/provider-utils';
import type { ZodType } from 'zod/v4';
import { createAmazonBedrockEventStreamDecoder } from './amazon-bedrock-event-stream-decoder';

export const createAmazonBedrockEventStreamResponseHandler =
  <T>(
    chunkSchema: ZodType<T, any>,
  ): ResponseHandler<ReadableStream<ParseResult<T>>> =>
  async ({ response }: { response: Response }) => {
    const responseHeaders = extractResponseHeaders(response);

    if (response.body == null) {
      throw new EmptyResponseBodyError({});
    }

    return {
      responseHeaders,
      value: createAmazonBedrockEventStreamDecoder<ParseResult<T>>(
        response.body,
        async (event, controller) => {
          if (event.messageType === 'event') {
            const parsedDataResult = await safeParseJSON({ text: event.data });
            if (!parsedDataResult.success) {
              controller.enqueue(parsedDataResult);
              return;
            }

            delete (parsedDataResult.value as any).p;
            const wrappedData = {
              [event.eventType]: parsedDataResult.value,
            };

            const validatedWrappedData = await safeValidateTypes<T>({
              value: wrappedData,
              schema: chunkSchema,
            });
            if (!validatedWrappedData.success) {
              controller.enqueue(validatedWrappedData);
            } else {
              controller.enqueue({
                success: true,
                value: validatedWrappedData.value,
                rawValue: wrappedData,
              });
            }
          }
        },
      ),
    };
  };
