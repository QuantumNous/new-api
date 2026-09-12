import { openai } from '@ai-sdk/openai';
import { OpenTelemetry } from '@ai-sdk/otel';
import { generateText, registerTelemetry, tool } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { run } from '../../lib/run';

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
registerTelemetry(
  new OpenTelemetry({
    runtimeContext: true,
    usage: true,
    providerMetadata: true,
    toolChoice: true,
  }),
);

run(async () => {
  await generateText({
    model: openai('gpt-3.5-turbo'),
    maxOutputTokens: 512,
    tools: {
      weather: weatherTool,
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
      }),
    },
    runtimeContext: {
      something: 'custom',
      someOtherThing: 'other-value',
    },
    prompt:
      'What is the weather in San Francisco and what attractions should I visit?',
    telemetry: {
      functionId: 'my-awesome-function',
    },
  });

  await sdk.shutdown();
});
