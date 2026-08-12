import { generateText, Output } from 'ai';
import { xai } from '@ai-sdk/xai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const { output } = await generateText({
    model: xai('grok-3-beta'),
    output: Output.object({
      schema: z.object({
        name: z.string(),
        age: z.number().nullable().describe('Age of the person.'),
        contact: z.object({
          type: z.literal('email'),
          value: z.string(),
        }),
        occupation: z.object({
          type: z.literal('employed'),
          company: z.string(),
          position: z.string(),
        }),
      }),
    }),
    prompt: 'Generate an example person for testing.',
  });
});
