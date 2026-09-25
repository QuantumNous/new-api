import { openai } from '@ai-sdk/openai';
import { jsonSchema, Output, streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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

  for await (const partialOutput of result.partialOutputStream) {
    console.clear();
    console.log(JSON.stringify(partialOutput, null, 2));
  }
});
