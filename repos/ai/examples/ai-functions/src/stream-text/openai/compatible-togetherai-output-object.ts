import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const togetherai = createOpenAICompatible({
    baseURL: 'https://api.together.xyz/v1',
    name: 'togetherai',
    headers: {
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
    },
  });
  const model = togetherai.chatModel('mistralai/Mistral-7B-Instruct-v0.1');
  const result = streamText({
    model,
    output: Output.object({
      schema: z.object({
        characters: z.array(
          z.object({
            name: z.string(),
            class: z
              .string()
              .describe('Character class, e.g. warrior, mage, or thief.'),
            description: z.string(),
          }),
        ),
      }),
    }),
    prompt:
      'Generate 3 character descriptions for a fantasy role playing game.',
  });

  for await (const partialOutput of result.partialOutputStream) {
    console.clear();
    console.log(partialOutput);
  }

  console.log();
  console.log('Token usage:', await result.usage);
});
