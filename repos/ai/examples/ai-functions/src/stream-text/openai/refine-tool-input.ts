import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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

  await printFullStream({ result });
});
