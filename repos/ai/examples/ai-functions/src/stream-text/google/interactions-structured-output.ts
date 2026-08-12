import { google } from '@ai-sdk/google';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google.interactions('gemini-2.5-flash'),
    output: Output.object({
      schema: z.object({
        name: z.string().describe('Full name of the person.'),
        age: z.number().describe('Age of the person in years.'),
      }),
    }),
    prompt: 'Generate an example person for testing.',
  });

  for await (const partialOutput of result.partialOutputStream) {
    console.clear();
    console.log(partialOutput);
  }
});
