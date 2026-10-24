import { openai } from '@ai-sdk/openai';
import { Output, streamText, type LanguageModelUsage } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5-mini'),
    output: Output.object({
      schema: z.object({
        recipe: z.object({
          name: z.string(),
          ingredients: z.array(z.string()),
          steps: z.array(z.string()),
        }),
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  function recordUsage(usage: LanguageModelUsage) {
    console.log('Input tokens:', usage.inputTokens);
    console.log(
      'Cached input tokens:',
      usage.inputTokenDetails.cacheReadTokens,
    );
    console.log('Reasoning tokens:', usage.outputTokenDetails.reasoningTokens);
    console.log('Output tokens:', usage.outputTokens);
    console.log('Total tokens:', usage.totalTokens);
  }

  result.usage.then(recordUsage);

  recordUsage(await result.usage);

  for await (const partialOutput of result.partialOutputStream) {
    void partialOutput;
  }
});
