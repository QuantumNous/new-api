import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { Output, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
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
    openai: {
      strictJsonSchema: true,
    } satisfies OpenAILanguageModelResponsesOptions,
  },
});

run(async () => {
  const result = await agent.stream({
    prompt: 'Generate a lasagna recipe.',
  });

  for await (const partialObject of result.partialOutputStream) {
    console.clear();
    console.dir(partialObject, { depth: Infinity });
  }
});
