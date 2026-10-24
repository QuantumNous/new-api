import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { generateText } from 'ai';
import { performance } from 'node:perf_hooks';
import { run } from '../../lib/run';

run(async () => {
  const start = performance.now();
  const result = await generateText({
    model: openai.responses('gpt-5.6'),
    reasoning: 'medium',
    prompt: `Review this deployment plan for failure modes:
1. Apply the database migration.
2. Deploy the application.
3. Take a database backup.

Return the three most important risks and a corrected deployment order.`,
    providerOptions: {
      openai: {
        reasoningMode: 'pro',
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  console.log(result.text);
  console.log(`Duration: ${Math.round(performance.now() - start)} ms`);
  console.log('Usage:', result.usage);
});
