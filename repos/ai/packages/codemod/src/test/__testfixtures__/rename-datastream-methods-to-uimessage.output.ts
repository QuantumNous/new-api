// @ts-nocheck
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
  });

  // Test toDataStream method call
  const stream = result.toUIMessageStream({ data: 'test' });
  
  // Test mergeIntoDataStream method call
  const dataStreamWriter = { write: () => {} };
  result.mergeIntoUIMessageStream(dataStreamWriter);

  // Test in more complex expressions
  return result.toUIMessageStream().pipeThrough(transform);

  // Test standalone reference (though less common)
  const method = result.toUIMessageStream;
  const mergeMethod = result.mergeIntoUIMessageStream;
}