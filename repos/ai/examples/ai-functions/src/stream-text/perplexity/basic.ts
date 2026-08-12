import { perplexity } from '@ai-sdk/perplexity';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: perplexity('sonar-pro'),
    prompt: 'What has happened in San Francisco recently?',
    providerOptions: {
      perplexity: {
        search_recency_filter: 'week',
      },
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Sources:', await result.sources);
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
  console.log(
    'Metadata:',
    JSON.stringify((await result.finalStep).providerMetadata, null, 2),
  );
});
