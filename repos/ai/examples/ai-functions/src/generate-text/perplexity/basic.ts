import { perplexity } from '@ai-sdk/perplexity';
import { generateText } from 'ai';
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
  });

  console.log(result.text);
  console.log();
  console.log('Sources:', result.sources);
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Metadata:', result.finalStep.providerMetadata);

  for (const source of result.sources) {
    if (source.sourceType === 'url') {
      console.log('ID:', source.id);
      console.log('Title:', source.title);
      console.log('URL:', source.url);
      console.log('Provider metadata:', source.providerMetadata);
      console.log();
    }
  }
});
