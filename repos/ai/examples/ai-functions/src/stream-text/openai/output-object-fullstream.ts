import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { Output, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-4o'),
    maxOutputTokens: 2000,
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
    providerOptions: {
      openai: {
        logprobs: 2,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
    prompt:
      'Generate 3 character descriptions for a fantasy role playing game.',
  });

  for await (const partialOutput of result.partialOutputStream) {
    console.clear();
    console.log(partialOutput);
  }

  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
});
