import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-pro'),
    providerOptions: {
      google: {
        structuredOutputs: false,
      } satisfies GoogleLanguageModelOptions,
    },
    output: Output.object({
      schema: z.object({
        name: z.string(),
        age: z.number(),
        contact: z.union([
          z.object({
            type: z.literal('email'),
            value: z.string(),
          }),
          z.object({
            type: z.literal('phone'),
            value: z.string(),
          }),
        ]),
        occupation: z.union([
          z.object({
            type: z.literal('employed'),
            company: z.string(),
            position: z.string(),
          }),
          z.object({
            type: z.literal('student'),
            school: z.string(),
            grade: z.number(),
          }),
          z.object({
            type: z.literal('unemployed'),
          }),
        ]),
      }),
    }),
    prompt: 'Generate an example person for testing.',
  });

  console.log(JSON.stringify(result.output, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
