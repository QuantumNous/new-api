import { openai } from '@ai-sdk/openai';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5-mini'),
    output: Output.object({
      schema: z.object({
        recipe: z.object({
          name: z.string(),
          ingredients: z.array(z.string()),
          steps: z.array(z.string()),
        }),
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  for await (const partialOutput of result.partialOutputStream) {
    void partialOutput;
  }

  try {
    const output = await result.output;
    console.log('Recipe:', JSON.stringify(output?.recipe, null, 2));
  } catch (error) {
    console.error(error);
  }
});
