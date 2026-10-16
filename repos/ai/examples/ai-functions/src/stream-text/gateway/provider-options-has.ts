import type { GatewayProviderOptions } from '@ai-sdk/gateway';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: 'deepseek/deepseek-v4-flash',
    prompt: 'Tell me the history of the tenrec in a few sentences.',
    providerOptions: {
      gateway: {
        has: ['implicit-caching'],
      } satisfies GatewayProviderOptions,
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
  console.log(
    'Provider metadata:',
    JSON.stringify((await result.finalStep).providerMetadata, null, 2),
  );
});
