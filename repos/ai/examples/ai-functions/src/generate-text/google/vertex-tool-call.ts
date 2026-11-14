import { googleVertex } from '@ai-sdk/google-vertex';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const { text } = await generateText({
    model: googleVertex('gemini-3.1-pro-preview'),
    prompt: 'What is the weather in New York City? ',
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => {
          console.log('Getting weather for', location);
          return {
            location,
            temperature: 72 + Math.floor(Math.random() * 21) - 10,
          };
        },
      }),
    },
    stopWhen: isStepCount(5),
  });

  console.log(text);
});
