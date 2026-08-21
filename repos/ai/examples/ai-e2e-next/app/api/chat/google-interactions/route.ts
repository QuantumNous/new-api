import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';

export const maxDuration = 30;

function findLatestInteractionId(messages: UIMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    for (const part of message.parts) {
      const id = (
        part as {
          providerMetadata?: { google?: { interactionId?: unknown } };
        }
      ).providerMetadata?.google?.interactionId;
      if (typeof id === 'string') {
        return id;
      }
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const previousInteractionId = findLatestInteractionId(messages);

  const result = streamText({
    model: google.interactions('gemini-3.1-flash-image-preview'),
    messages: await convertToModelMessages(messages),
    reasoning: 'high',
    providerOptions: {
      google: {
        responseModalities: ['text', 'image'],
        thinkingSummaries: 'auto',
        ...(previousInteractionId != null ? { previousInteractionId } : {}),
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
