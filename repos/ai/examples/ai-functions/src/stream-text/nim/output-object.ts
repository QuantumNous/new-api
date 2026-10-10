import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const nim = createOpenAICompatible({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    name: 'nim',
    headers: {
      Authorization: `Bearer ${process.env.NIM_API_KEY}`,
    },
  });
  const model = nim.chatModel('meta/llama-3.3-70b-instruct');
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
