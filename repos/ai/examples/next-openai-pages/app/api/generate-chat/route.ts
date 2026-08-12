import { generateText, type ModelMessage } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages }: { messages: ModelMessage[] } = await req.json();

  const { responseMessages } = await generateText({
    model: openai('gpt-5'),
    instructions: 'You are a helpful assistant.',
    messages,
  });

  return Response.json({ messages: responseMessages });
}
