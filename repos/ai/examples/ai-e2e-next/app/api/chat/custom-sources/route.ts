import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const modelMessages = await convertToModelMessages(messages);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: 'start' });

      // write a custom url source to the stream:
      writer.write({
        type: 'source-url',
        sourceId: 'source-1',
        url: 'https://example.com',
        title: 'Example Source',
      });

      const result = streamText({
        model: openai('gpt-4o'),
        messages: modelMessages,
      });

      writer.merge(
        toUIMessageStream({ stream: result.stream, sendStart: false }),
      );
    },
    originalMessages: messages,
    onFinish: options => {
      console.log('onFinish', JSON.stringify(options, null, 2));
    },
  });

  return createUIMessageStreamResponse({ stream });
}
