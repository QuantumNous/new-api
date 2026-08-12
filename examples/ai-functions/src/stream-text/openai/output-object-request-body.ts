import { openai } from '@ai-sdk/openai';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-4o-mini'),
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
  });

  for await (const part of result.partialOutputStream) {
    void part;
  }

  console.log('REQUEST BODY');
  console.log((await result.request).body);
});
