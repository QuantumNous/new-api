import { openai } from '@ai-sdk/openai';
import { saveChat } from '@util/chat-store';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
export async function POST(req: Request) {
  const { messages, chatId }: { messages: UIMessage[]; chatId: string } =
    await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: await convertToModelMessages(messages),
  });

  // consume the stream to ensure it runs to completion and triggers onFinish
  // even when the client response is aborted (e.g. when the browser tab is closed).
  // no await
  result.consumeStream({
    onError: error => {
      console.log('Error during background stream consumption: ', error); // optional error callback
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      onFinish: ({ messages }) => {
        saveChat({ chatId, messages });
      },
    }),
  });
}
