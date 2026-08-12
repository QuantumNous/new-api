import { openai } from '@ai-sdk/openai';
import { streamText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5.4'),
    tools: {
      weather: weatherTool,
      slowApi: tool({
        description: 'Fetch data from a slow API',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }, { abortSignal }) => {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 10000);
            abortSignal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('tool timed out'));
            });
          });
          return { result: query };
        },
      }),
    },
    timeout: {
      toolMs: 2000,
    },
    stopWhen: isStepCount(3),
    prompt: 'What is the weather in San Francisco?',
  });

  for await (const part of result.textStream) {
    process.stdout.write(part);
  }

  console.log();
});
