import type { GatewayProviderOptions } from '@ai-sdk/gateway';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: 'anthropic/claude-haiku-4.5',
    prompt: 'Invent a new holiday and describe its traditions.',
    providerOptions: {
      gateway: {
        byok: {
          anthropic: [{ apiKey: process.env.ANTHROPIC_API_KEY }],
        },
      } satisfies GatewayProviderOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log('Usage:', result.usage);
  console.log(JSON.stringify(result.finalStep.providerMetadata, null, 2));
});
