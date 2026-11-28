import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5'),
    output: Output.object({
      schema: z.object({
        analysis: z.object({
          problem: z.string(),
          solution: z.object({
            approach: z.string(),
            steps: z.array(z.string()),
            timeComplexity: z.string(),
            spaceComplexity: z.string(),
          }),
          code: z.string(),
        }),
      }),
    }),
    prompt:
      'Analyze and solve: How would you implement a function to find the longest palindromic substring in a string?',
  });

  console.log(JSON.stringify(result.output?.analysis, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
