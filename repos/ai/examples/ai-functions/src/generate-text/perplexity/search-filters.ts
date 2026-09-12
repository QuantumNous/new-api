import {
  perplexity,
  type PerplexityLanguageModelOptions,
} from '@ai-sdk/perplexity';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: perplexity('sonar-pro'),
    prompt:
      'Summarize recent United States federal AI policy updates from official sources.',
    providerOptions: {
      perplexity: {
        search_domain_filter: [
          'whitehouse.gov',
          'congress.gov',
          'federalregister.gov',
        ],
        search_language_filter: ['en'],
        search_after_date_filter: '1/1/2026',
      } satisfies PerplexityLanguageModelOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log('Sources:', result.sources);
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Metadata:', result.finalStep.providerMetadata);
});
