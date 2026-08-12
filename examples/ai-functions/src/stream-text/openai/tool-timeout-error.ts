import { openai } from '@ai-sdk/openai';
import { streamText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5.4'),
    tools: {
      slowApi: tool({
        description: 'Fetch data from an API',
        inputSchema: z.object({ query: z.string() }),
        execute: async (_input, { abortSignal }) => {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 10000);
            abortSignal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(abortSignal.reason);
            });
          });
          return { data: 'this will never resolve' };
        },
      }),
    },
    timeout: {
      toolMs: 500,
    },
    stopWhen: isStepCount(2),
    prompt: 'Search for "hello world"',
  });

  for await (const part of result.stream) {
    if (part.type === 'tool-call') {
      console.log(`tool-call: ${part.toolName}(${JSON.stringify(part.input)})`);
    }
    if (part.type === 'tool-error') {
      console.log(`tool-error: ${part.toolName} timed out`);
    }
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }

  console.log();
});
