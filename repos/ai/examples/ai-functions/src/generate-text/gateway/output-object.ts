import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: 'xai/grok-3-beta',
    output: Output.object({
      schema: z.object({
        recipe: z.object({
          name: z.string(),
          ingredients: z.array(
            z.object({
              name: z.string(),
              amount: z.string(),
            }),
          ),
          steps: z.array(z.string()),
        }),
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  console.log(JSON.stringify(result.output?.recipe, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
