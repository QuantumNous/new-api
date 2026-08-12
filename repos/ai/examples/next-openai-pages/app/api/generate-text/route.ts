import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const { text } = await generateText({
    model: openai('gpt-5'),
    instructions: 'You are a helpful assistant.',
    prompt,
  });

  return Response.json({ text });
}
