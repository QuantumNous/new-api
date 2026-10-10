import { openai } from '@ai-sdk/openai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { registerTelemetry, tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
registerTelemetry(new LegacyOpenTelemetry());

const agent = new ToolLoopAgent({
  model: openai('gpt-5-mini'),
  instructions: 'You are a helpful assistant. Use the weather tool.',
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72,
      }),
    }),
  },
  runtimeContext: {
    userId: 'user-123',
    requestId: 'request-123',
    secretApiKey: 'sk-secret',
  },
  telemetry: {
    functionId: 'my-awesome-agent',
    includeRuntimeContext: {
      requestId: true,
    },
  },
});

run(async () => {
  await agent.generate({
    prompt: 'What is the weather in San Francisco?',
  });

  await sdk.shutdown();
});
