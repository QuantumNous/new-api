import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const { text } = await generateText({
    model: openai('gpt-5-mini'),
    maxOutputTokens: 100,
    prompt,
    runtimeContext: {
      example: 'value',
    },
    telemetry: {
      functionId: 'example-function-id',
    },
  });

  return new Response(JSON.stringify({ text }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
