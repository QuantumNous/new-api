import { groq, type GroqLanguageModelChatOptions } from '@ai-sdk/groq';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: groq('moonshotai/kimi-k2-instruct-0905'),
    output: Output.object({
      schema: z.object({
        recipe: z.object({
          name: z.string(),
          ingredients: z.array(
            z.object({
              name: z.string(),
              amount: z.string(),
            }),
          ),
          steps: z.array(z.string()),
        }),
      }),
    }),
    providerOptions: {
      groq: {
        strictJsonSchema: true,
      } satisfies GroqLanguageModelChatOptions,
    },
    prompt: 'Generate a lasagna recipe.',
  });

  console.log(JSON.stringify(result.output, null, 2));
});
