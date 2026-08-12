import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const {
    output: { events },
  } = await generateText({
    model: openai('gpt-5-mini'),
    output: Output.object({
      schema: z.object({
        events: z.array(
          z.object({
            date: z
              .string()
              .date()
              .transform(value => new Date(value)),
            event: z.string(),
          }),
        ),
      }),
    }),
    prompt: 'List 5 important events from the year 2000.',
  });

  console.log(events);
});
