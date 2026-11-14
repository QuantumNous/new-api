import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google('gemini-3.1-flash-image-preview'),
    tools: {
      google_search: google.tools.googleSearch({
        searchTypes: { imageSearch: {} },
      }),
    },
    providerOptions: {
      google: {
        responseModalities: ['TEXT', 'IMAGE'],
      } satisfies GoogleLanguageModelOptions,
    },
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, sendSources: true }),
  });
}
