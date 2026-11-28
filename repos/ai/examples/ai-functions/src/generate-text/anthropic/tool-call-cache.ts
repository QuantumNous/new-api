import { anthropic } from '@ai-sdk/anthropic';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-haiku-4-5'),
    tools: {
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      }),
    },
    prompt: 'What attractions should I visit in San Francisco?',
  });

  console.log(JSON.stringify(result.request.body, null, 2));
});
