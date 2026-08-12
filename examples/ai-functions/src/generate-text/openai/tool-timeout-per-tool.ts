import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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
              reject(abortSignal.reason);
            });
          });
          return { result: query };
        },
      }),
    },
    timeout: {
      toolMs: 2000,
      tools: {
        weatherMs: 3000,
      },
    },
    stopWhen: isStepCount(2),
    prompt: 'What is the weather in San Francisco?',
  });

  console.log(result.text);
});
