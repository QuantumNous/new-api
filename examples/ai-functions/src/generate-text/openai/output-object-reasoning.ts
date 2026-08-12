import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5'),
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
    prompt: 'Generate a lasagna recipe.',
    providerOptions: {
      openai: {
        strictJsonSchema: true,
        reasoningSummary: 'detailed',
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  console.log(result.reasoning);
  console.log(JSON.stringify(result.output?.recipe, null, 2));
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
