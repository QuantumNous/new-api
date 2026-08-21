import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import fs from 'node:fs';
import { z } from 'zod';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

run(async () => {
  const result1 = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: errorMessage,
    output: Output.object({
      schema: z.object({
        error: z.string(),
        stack: z.string(),
      }),
    }),
  });

  console.log(result1.output);
  console.log(result1.finalStep.providerMetadata?.google);

  const result2 = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: errorMessage,
    output: Output.object({
      schema: z.object({
        error: z.string(),
        stack: z.string(),
      }),
    }),
  });

  console.log(result2.output);
  console.log(result2.finalStep.providerMetadata?.google);
});
