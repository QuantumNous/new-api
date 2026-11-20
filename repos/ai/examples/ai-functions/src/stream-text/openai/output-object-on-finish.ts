import { openai } from '@ai-sdk/openai';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5-mini'),
    output: Output.object({
      schema: z.object({
        characters: z.array(
          z.object({
            name: z.string(),
            class: z
              .string()
              .describe('Character class, e.g. warrior, mage, or thief.'),
            description: z.string(),
          }),
        ),
      }),
    }),
    prompt:
      'Generate 3 character descriptions for a fantasy role playing game.',
    onEnd({ usage }) {
      console.log();
      console.log('onEnd');
      console.log('Token usage:', usage);
    },
  });

  for await (const partialOutput of result.partialOutputStream) {
    void partialOutput;
  }

  console.log('Final output:', JSON.stringify(await result.output, null, 2));
});
