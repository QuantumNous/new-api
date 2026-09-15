import { anthropic } from '@ai-sdk/anthropic';
import { streamText, ToolLoopAgent, registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { DevToolsTelemetry } from '@ai-sdk/devtools';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { printFullStream } from '../../lib/print-full-stream';
import { print } from '../../lib/print';
import { run } from '../../lib/run';
import { z } from 'zod';

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();
registerTelemetry(new LegacyOpenTelemetry(), DevToolsTelemetry());

const weatherAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  instructions: 'You compare weather across cities. Use the researchCity tool.',
  tools: {
    researchCity: {
      description:
        'Research detailed weather information for a city using a sub-agent',
      inputSchema: z.object({
        city: z.string().describe('The city to research'),
      }),
      execute: async ({ city }: { city: string }) => {
        const subResult = streamText({
          model: anthropic('claude-sonnet-4-5-20250929'),
          prompt: `You are a weather expert. Provide a brief weather report for ${city} including temperature, conditions, and a fun fact about the climate.`,
          telemetry: {
            functionId: `weather-subagent-${city.toLowerCase()}`,
          },
        });
        return await subResult.text;
      },
    },
  },
  telemetry: {
    functionId: 'weather-comparison-agent',
  },
});

run(async () => {
  const result = await weatherAgent.stream({
    prompt: 'Research the weather in Tokyo and Paris, then compare them.',
  });

  printFullStream({ result });

  print('Usage:', await result.usage);
  print('Finish reason:', await result.finishReason);

  await sdk.shutdown();
});
