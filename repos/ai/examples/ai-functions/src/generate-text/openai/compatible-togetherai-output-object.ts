import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const togetherai = createOpenAICompatible({
    baseURL: 'https://api.together.xyz/v1',
    name: 'togetherai',
    headers: {
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
    },
    supportsStructuredOutputs: true,
  });
  const model = togetherai.chatModel('mistralai/Mistral-7B-Instruct-v0.1');
  const result = await generateText({
    model,
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
  });

  console.log(JSON.stringify(result.output?.recipe, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
