import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const { output } = await generateText({
    model: google.interactions('gemini-2.5-flash'),
    output: Output.object({
      schema: z.object({
        name: z.string().describe('Full name of the person.'),
        age: z.number().describe('Age of the person in years.'),
      }),
    }),
    prompt: 'Generate an example person for testing.',
  });

  console.log(output);
});
