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
  const stream = result.toDataStream({ data: 'test' });
  
  // Test mergeIntoDataStream method call
  const dataStreamWriter = { write: () => {} };
  result.mergeIntoDataStream(dataStreamWriter);

  // Test in more complex expressions
  return result.toDataStream().pipeThrough(transform);

  // Test standalone reference (though less common)
  const method = result.toDataStream;
  const mergeMethod = result.mergeIntoDataStream;
}