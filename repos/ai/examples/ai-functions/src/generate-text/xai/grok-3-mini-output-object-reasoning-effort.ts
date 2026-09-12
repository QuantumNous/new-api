import { xai } from '@ai-sdk/xai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai('grok-3-mini'),
    output: Output.object({
      schema: z.object({
        name: z.string(),
        age: z.number().optional(),
        occupation: z.string().optional(),
      }),
    }),
    instructions: 'identify the person information from the following text',
    messages: [
      {
        role: 'user',
        content:
          'my name is john doe, i am 35 years old and work as a software engineer',
      },
    ],
    reasoning: 'high',
  });

  console.log('extracted person:', result.output);
  console.log();
  console.log('token usage:', result.usage);
  console.log('finish reason:', result.finishReason);
});
