import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { type } from 'arktype';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    output: Output.object({
      schema: type({
        recipe: {
          name: 'string',
          ingredients: type({ name: 'string', amount: 'string' }).array(),
          steps: 'string[]',
        },
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  console.dir(result.output.recipe, { depth: Infinity });
});
