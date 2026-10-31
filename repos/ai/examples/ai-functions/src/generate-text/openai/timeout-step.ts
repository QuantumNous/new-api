import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const { text, usage, steps } = await generateText({
    model: openai('gpt-4o'),
    prompt: 'What is the weather in San Francisco?',
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72,
          unit: 'fahrenheit',
        }),
      }),
    },
    stopWhen: isStepCount(5),
    timeout: { stepMs: 1000 }, // 1 second timeout per step
  });

  console.log(text);
  console.log();
  console.log('Usage:', usage);
  console.log('Steps:', steps.length);
});
