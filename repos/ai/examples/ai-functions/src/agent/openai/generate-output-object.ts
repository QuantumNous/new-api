import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { Output, ToolLoopAgent } from 'ai';
import { run } from '../../lib/run';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  callOptionsSchema: z.object({
    strict: z.boolean(),
  }),
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
  prepareCall: ({ options, ...rest }) => ({
    ...rest,
    providerOptions: {
      openai: {
        strictJsonSchema: options.strict,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  }),
});

run(async () => {
  const { output } = await agent.generate({
    prompt: 'Generate a lasagna recipe.',
    options: {
      strict: true,
    },
  });

  console.dir(output, { depth: Infinity });
});
