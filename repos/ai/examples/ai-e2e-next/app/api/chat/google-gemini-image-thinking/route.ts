import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import {
  createUIMessageStreamResponse,
  streamText,
  convertToModelMessages,
  toUIMessageStream,
} from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google('gemini-3-pro-image-preview'),
    messages: await convertToModelMessages(messages),
    reasoning: 'high',
    providerOptions: {
      google: {
        responseModalities: ['TEXT', 'IMAGE'],
        thinkingConfig: {
          includeThoughts: true,
        },
      } satisfies GoogleLanguageModelOptions,
    },
    includeRawChunks: true,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
