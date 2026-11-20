import { anthropic } from '@ai-sdk/anthropic';
import { generateText, ToolLoopAgent, registerTelemetry } from 'ai';
import { OpenTelemetry } from '@ai-sdk/otel';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { run } from '../../lib/run';
import { z } from 'zod';

registerTelemetry(
  new OpenTelemetry({
    usage: true,
    providerMetadata: true,
    toolChoice: true,
  }),
);

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

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
        const subResult = await generateText({
          model: anthropic('claude-sonnet-4-5-20250929'),
          prompt: `You are a weather expert. Provide a brief weather report for ${city} including temperature, conditions, and a fun fact about the climate.`,
          telemetry: {
            functionId: `weather-subagent-${city.toLowerCase()}`,
          },
        });
        return subResult.text;
      },
    },
  },
  telemetry: {
    functionId: 'weather-comparison-agent',
  },
});

run(async () => {
  const result = await weatherAgent.generate({
    prompt: 'Research the weather in Tokyo and Paris, then compare them.',
  });

  console.log('Text:');
  console.log(result.text);

  await sdk.shutdown();
});
