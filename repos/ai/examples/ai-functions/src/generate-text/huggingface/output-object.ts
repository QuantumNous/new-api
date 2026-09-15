import { huggingFace } from '@ai-sdk/huggingface';
import { generateText, Output } from 'ai';
import { z } from 'zod/v4';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: huggingFace.responses('moonshotai/Kimi-K2-Instruct'),
    output: Output.object({
      schema: z.object({
        name: z.string(),
        age: z.number(),
        email: z.string(),
      }),
    }),
    prompt:
      'Generate a simple person profile with name, age, and email. Return only valid JSON.',
  });

  console.log('Generated output:', result.output);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
