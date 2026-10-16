import { openai } from '@ai-sdk/openai';
import {
  consumeStream,
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
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onFinish: async ({ isAborted }) => {
        if (isAborted) {
          console.log('Aborted');
        }
      },
    }),
    consumeSseStream: consumeStream, // needed for correct abort handling
  });
}
