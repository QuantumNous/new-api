import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';

import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { run } from '../../lib/run';

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
registerTelemetry(new LegacyOpenTelemetry());

run(async () => {
  const myCustomProvider = createAnthropic({
    name: 'my-anthropic-proxy',
  });

  await generateText({
    model: myCustomProvider('claude-sonnet-4-20250514'),
    prompt: 'Say hello in 5 words',
    telemetry: {
      functionId: 'anthropic-custom-provider-demo',
    },
  });

  await sdk.shutdown();
});
