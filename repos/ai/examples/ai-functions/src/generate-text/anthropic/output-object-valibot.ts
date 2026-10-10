import { anthropic } from '@ai-sdk/anthropic';
import { valibotSchema } from '@ai-sdk/valibot';
import { generateText, Output } from 'ai';
import * as v from 'valibot';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    output: Output.object({
      schema: valibotSchema(
        v.strictObject({
          recipe: v.strictObject({
            name: v.string(),
            ingredients: v.array(
              v.strictObject({
                name: v.string(),
                amount: v.string(),
              }),
            ),
            steps: v.array(v.string()),
          }),
        }),
      ),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  console.dir(result.output.recipe, { depth: Infinity });
});
