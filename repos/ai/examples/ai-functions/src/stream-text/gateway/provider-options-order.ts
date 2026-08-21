import type { GatewayProviderOptions } from '@ai-sdk/gateway';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: 'anthropic/claude-4-sonnet',
    prompt: 'Invent a new holiday and describe its traditions.',
    providerOptions: {
      gateway: {
        order: ['bedrock', 'anthropic'],
      } satisfies GatewayProviderOptions,
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Provider metadata:', (await result.finalStep).providerMetadata);
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
