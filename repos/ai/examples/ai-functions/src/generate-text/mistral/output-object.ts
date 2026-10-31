import { mistral, type MistralLanguageModelChatOptions } from '@ai-sdk/mistral';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: mistral('open-mistral-7b'),
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
      mistral: {
        strictJsonSchema: true,
      } satisfies MistralLanguageModelChatOptions,
    },
  });

  console.log(JSON.stringify(result.output?.recipe, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
