import {
  convertBase64ToUint8Array,
  safeParseJSON,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { createAmazonBedrockEventStreamDecoder } from '../amazon-bedrock-event-stream-decoder';

const amazonBedrockErrorSchema = z.looseObject({
  message: z.string().optional(),
});

export function createAmazonBedrockAnthropicFetch(
  baseFetch: FetchFunction,
): FetchFunction {
  return async (url, options) => {
    const response = await baseFetch(url, options);

    // Transform Bedrock error responses into Anthropic error format
    // so that anthropicFailedResponseHandler can extract the message.
    if (!response.ok) {
      const text = await response.text();
      const parsed = await safeParseJSON({
        text,
        schema: amazonBedrockErrorSchema,
      });

      const message =
        parsed.success && parsed.value.message ? parsed.value.message : text;

      const anthropicError = JSON.stringify({
        type: 'error',
        error: { type: 'error', message },
      });

      return new Response(anthropicError, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    const contentType = response.headers.get('content-type');
    if (
      contentType?.includes('application/vnd.amazon.eventstream') &&
      response.body != null
    ) {
      const transformedBody = transformAmazonBedrockEventStreamToSSE(
        response.body,
      );

      return new Response(transformedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers({
          ...Object.fromEntries(response.headers.entries()),
          'content-type': 'text/event-stream',
        }),
      });
    }

    return response;
  };
}

function transformAmazonBedrockEventStreamToSSE(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const textEncoder = new TextEncoder();

  return createAmazonBedrockEventStreamDecoder(
    body,
    async (event, controller) => {
      if (event.messageType === 'event') {
        if (event.eventType === 'chunk') {
          const parsed = await safeParseJSON({ text: event.data });
          if (!parsed.success) {
            controller.enqueue(textEncoder.encode(`data: ${event.data}\n\n`));
            return;
          }
          const bytes = (parsed.value as { bytes?: string }).bytes;
          if (bytes) {
            const anthropicEvent = new TextDecoder().decode(
              convertBase64ToUint8Array(bytes),
            );
            controller.enqueue(
              textEncoder.encode(`data: ${anthropicEvent}\n\n`),
            );
          } else {
            controller.enqueue(textEncoder.encode(`data: ${event.data}\n\n`));
          }
        } else if (event.eventType === 'messageStop') {
          controller.enqueue(textEncoder.encode('data: [DONE]\n\n'));
        }
      } else if (event.messageType === 'exception') {
        controller.enqueue(
          textEncoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: event.data })}\n\n`,
          ),
        );
      }
    },
  );
}
