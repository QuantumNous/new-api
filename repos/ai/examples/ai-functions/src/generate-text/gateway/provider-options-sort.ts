import type { GatewayProviderOptions } from '@ai-sdk/gateway';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: 'openai/gpt-oss-120b',
    prompt: 'Invent a new holiday and describe its traditions.',
    providerOptions: {
      gateway: {
        sort: 'ttft',
      } satisfies GatewayProviderOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log('Usage:', result.usage);
  console.log(JSON.stringify(result.finalStep.providerMetadata, null, 2));
});
