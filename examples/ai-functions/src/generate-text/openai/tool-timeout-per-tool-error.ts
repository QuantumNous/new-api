import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5.4'),
    tools: {
      fastApi: tool({
        description: 'A fast API that responds quickly',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }, { abortSignal }) => {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 500);
            abortSignal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(abortSignal.reason);
            });
          });
          return { result: query, source: 'fast-api' };
        },
      }),
      slowApi: tool({
        description: 'A slow API that takes a long time',
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
      toolMs: 5000,
      tools: {
        fastApiMs: 2000,
        slowApiMs: 1000,
      },
    },
    stopWhen: isStepCount(3),
    prompt: 'Search for "hello" using both the fast API and slow API',
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
