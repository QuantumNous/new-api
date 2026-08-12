import { perplexity } from '@ai-sdk/perplexity';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: perplexity('sonar-pro'),
    prompt: 'What has happened in San Francisco recently?',
    providerOptions: {
      perplexity: {
        search_recency_filter: 'week',
      },
    },
    output: Output.array({
      element: z.object({
        title: z.string(),
        summary: z.string(),
      }),
    }),
  });

  console.log(result.output);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Metadata:', result.finalStep.providerMetadata);
});
