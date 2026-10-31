import { openai } from '@ai-sdk/openai';
import { loadChat, saveChat } from '@util/chat-store';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
export async function POST(req: Request) {
  const { message, chatId }: { message: UIMessage; chatId: string } =
    await req.json();

  const previousMessages = await loadChat(chatId);
  const messages = [...previousMessages, message];

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: await convertToModelMessages(messages),
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
