import { generateText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-3-flash-preview'),
    tools: {
      code_execution: google.tools.codeExecution({}),
    },
    output: Output.object({
      schema: z.object({
        answer: z.number(),
        explanation: z.string(),
      }),
    }),
    prompt: 'Calculate the sum of the first 50 prime numbers. Show your work.',
  });

  console.log(result.output);
});
