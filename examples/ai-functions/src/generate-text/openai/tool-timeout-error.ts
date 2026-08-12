import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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

  for (const step of result.steps) {
    for (const part of step.content) {
      if (part.type === 'tool-call') {
        console.log(
          `tool-call: ${part.toolName}(${JSON.stringify(part.input)})`,
        );
      }
      if (part.type === 'tool-error') {
        console.log(`tool-error: ${part.toolName} timed out`);
      }
    }
  }

  console.log();
  console.log(result.text);
});
