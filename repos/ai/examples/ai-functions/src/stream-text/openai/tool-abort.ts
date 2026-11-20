import { openai } from '@ai-sdk/openai';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const abortController = new AbortController();

  const result = streamText({
    model: openai('gpt-4o'),
    stopWhen: isStepCount(5),
    tools: {
      currentLocation: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }, { abortSignal }) => {
          console.log('Starting tool call');

          // simulate compute for 10 seconds, check abort signal every 50ms
          for (let i = 0; i < 10000 / 50; i++) {
            await new Promise(resolve => setTimeout(resolve, 50));
            abortSignal?.throwIfAborted();
          }

          console.log('Tool call finished');

          return {
            location,
            temperature: 72 + Math.floor(Math.random() * 21) - 10,
          };
        },
      }),
    },
    prompt: 'What is the weather in New York?',
    abortSignal: abortController.signal,
  });

  // delay for 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));

  abortController.abort();

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
});
