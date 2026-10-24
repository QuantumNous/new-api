import { openai } from '@ai-sdk/openai';
import { generateText, Output, jsonSchema } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5-mini'),
    output: Output.object({
      schema: jsonSchema<{
        recipe: {
          name: string;
          ingredients: { name: string; amount: string }[];
          steps: string[];
        };
      }>({
        type: 'object',
        properties: {
          recipe: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              ingredients: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    amount: { type: 'string' },
                  },
                  required: ['name', 'amount'],
                },
              },
              steps: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['name', 'ingredients', 'steps'],
          },
        },
        required: ['recipe'],
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  console.log(JSON.stringify(result.output?.recipe, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
