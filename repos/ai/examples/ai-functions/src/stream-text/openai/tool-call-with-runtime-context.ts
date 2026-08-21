import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5-mini'),
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => {
          return {
            location,
            temperature: 72 + Math.floor(Math.random() * 21) - 10,
          };
        },
      }),
    },
    runtimeContext: {
      requestId: 'req-123',
      completedSteps: 0,
    },
    prepareStep: async ({ runtimeContext, steps }) => {
      console.log('prepareStep runtimeContext:', runtimeContext);

      return {
        runtimeContext: {
          ...runtimeContext,
          completedSteps: steps.length,
        },
      };
    },
    onEnd: ({ runtimeContext }) => {
      console.log('onEnd runtimeContext:', runtimeContext);
    },
    prompt: 'What is the weather in San Francisco?',
  });

  await printFullStream({ result });
  console.log(
    'final runtimeContext:',
    (await result.steps).at(-1)?.runtimeContext,
  );
});
