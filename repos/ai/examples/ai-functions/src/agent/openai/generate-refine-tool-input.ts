import { openai } from '@ai-sdk/openai';
import { isStepCount, tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: openai('gpt-5-mini'),
  instructions:
    'Use the weather tool when a user asks about weather. Then summarize the result.',
  stopWhen: isStepCount(2),
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
});

run(async () => {
  const result = await agent.generate({
    prompt: 'What is the weather in "  San Francisco  "?',
  });

  console.log(JSON.stringify(result.steps, null, 2));
});
