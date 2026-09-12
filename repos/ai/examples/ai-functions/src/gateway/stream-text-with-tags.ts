import type { GatewayProviderOptions } from '@ai-sdk/gateway';
import { streamText } from 'ai';
import { run } from '../lib/run';

run(async () => {
  const result = streamText({
    model: 'anthropic/claude-haiku-4.5',
    prompt: 'What are three interesting facts about honeybees?',
    providerOptions: {
      gateway: {
        tags: ['team:examples', 'feature:reporting-test', 'env:development'],
      } satisfies GatewayProviderOptions,
    },
  });

  for await (const text of result.textStream) {
    process.stdout.write(text);
  }

  console.log('\n');
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
  console.log(
    'Provider metadata:',
    JSON.stringify(await result.providerMetadata, null, 2),
  );
});
