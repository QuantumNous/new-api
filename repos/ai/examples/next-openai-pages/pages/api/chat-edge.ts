import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';

export const runtime = 'edge';

export default async function handler(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-5-mini'),
    messages,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
