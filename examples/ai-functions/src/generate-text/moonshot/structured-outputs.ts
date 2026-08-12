import { moonshotai } from '@ai-sdk/moonshotai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: moonshotai('kimi-k3'),
    output: Output.object({
      schema: z.object({
        holiday: z.string(),
        traditions: z.array(z.string()),
      }),
    }),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(JSON.stringify(result.output, null, 2));
});
