import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type ModelMessage,
} from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages }: { messages: ModelMessage[] } = await req.json();

  const result = streamText({
    model: openai('gpt-5.6'),
    instructions: 'You are a helpful assistant.',
    messages,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
