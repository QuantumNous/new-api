import { vercel } from '@ai-sdk/vercel';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: vercel('v0-1.5-md'),
    output: Output.object({
      schema: z.object({
        button: z.object({
          element: z.string(),
          baseStyles: z.object({
            padding: z.string(),
            borderRadius: z.string(),
            border: z.string(),
            backgroundColor: z.string(),
            color: z.string(),
            cursor: z.string(),
          }),
          hoverStyles: z.object({
            backgroundColor: z.string(),
            transform: z.string().optional(),
          }),
        }),
      }),
    }),
    prompt: 'Generate CSS styles for a modern primary button component.',
  });

  console.log(JSON.stringify(result.output?.button, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
