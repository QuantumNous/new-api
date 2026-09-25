import { openai } from '@ai-sdk/openai';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5'),
    output: Output.object({
      schema: z.object({
        analysis: z.object({
          topic: z.string(),
          keyPoints: z.array(
            z.object({
              point: z.string(),
              explanation: z.string(),
              importance: z.enum(['low', 'medium', 'high']),
            }),
          ),
          conclusion: z.string(),
          recommendations: z.array(z.string()),
        }),
      }),
    }),
    prompt:
      'Analyze the impact of artificial intelligence on modern software development practices.',
  });

  for await (const partialOutput of result.partialOutputStream) {
    console.clear();
    console.log(partialOutput);
  }
});
