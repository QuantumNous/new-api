import { xai } from '@ai-sdk/xai';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: xai('grok-3-beta'),
    output: Output.object({
      schema: z.object({
        name: z.string(),
        ingredients: z.array(
          z.object({
            name: z.string(),
            amount: z.string(),
          }),
        ),
        steps: z.array(z.string()),
      }),
      name: 'recipe',
      description: 'A recipe for lasagna.',
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  for await (const partialOutput of result.partialOutputStream) {
    console.clear();
    console.log(partialOutput);
  }
});
