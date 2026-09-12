import { openai } from '@ai-sdk/openai';
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
  await generateText({
    model: openai('gpt-5-mini'),
    prompt: 'Invent a new holiday and describe its traditions.',
    telemetry: {
      functionId: 'my-awesome-function',
      includeRuntimeContext: {
        something: true,
        someOtherThing: true,
      },
    },
    runtimeContext: {
      something: 'custom',
      someOtherThing: 'other-value',
      secretApiKey: 'sk-secret',
    },
  });

  await sdk.shutdown();
});
