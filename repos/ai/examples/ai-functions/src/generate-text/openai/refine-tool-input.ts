import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5-mini'),
    toolChoice: { type: 'tool', toolName: 'weather' },
    tools: {
      weather: tool({
        description: 'Get the weather for a city.',
        inputSchema: z.object({
          city: z.string(),
        }),
        execute: async ({ city }) => {
          return { city, weather: 'sunny' };
        },
      }),
    },
    experimental_refineToolInput: {
      weather: input => ({
        city: input.city.trim().toLowerCase(),
      }),
    },
    prompt: 'Get the weather for "  San Francisco  ".',
  });

  console.log(JSON.stringify(result.toolCalls, null, 2));
  console.log(JSON.stringify(result.toolResults, null, 2));
});
