import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    output: Output.object({
      schema: z.object({
        recipe: z.object({
          name: z.string(),
          ingredients: z
            .array(z.object({ name: z.string(), amount: z.string() }))
            .min(10)
            .max(12),
          steps: z.array(z.string()),
        }),
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  print('Output:', result.output);
  print('Request:', result.request.body);
});
