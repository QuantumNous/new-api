import type { GatewayProviderOptions } from '@ai-sdk/gateway';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    headers: {
      'X-Simulate-Model-Failures': 'anthropic/claude-4-sonnet',
    },
    model: 'anthropic/claude-4-sonnet',
    prompt: 'Tell me a short tale of the krakens of the deep.',
    providerOptions: {
      gateway: {
        models: ['openai/gpt-5-nano', 'zai/glm-4.6'],
      } satisfies GatewayProviderOptions,
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log(
    'Provider metadata:',
    JSON.stringify((await result.finalStep).providerMetadata, null, 2),
  );
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
