import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z as z4 } from 'zod/v4';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5-nano'),
    output: Output.object({
      schema: z4.object({
        recipe: z4.object({
          name: z4.string(),
          ingredients: z4.array(
            z4.object({ name: z4.string(), amount: z4.string() }),
          ),
          steps: z4.array(z4.string()),
        }),
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  print('Output:', result.output);
  print('Request:', result.request.body);
});
