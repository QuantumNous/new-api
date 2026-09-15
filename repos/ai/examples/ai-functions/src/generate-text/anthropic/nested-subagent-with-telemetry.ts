import { anthropic } from '@ai-sdk/anthropic';
import { generateText, ToolLoopAgent, registerTelemetry } from 'ai';
import { OpenTelemetry, LegacyOpenTelemetry } from '@ai-sdk/otel';
import { DevToolsTelemetry } from '@ai-sdk/devtools';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { run } from '../../lib/run';
import { z } from 'zod';

registerTelemetry(new LegacyOpenTelemetry(), DevToolsTelemetry());

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

const createCityResearchAgent = (city: string) =>
  new ToolLoopAgent({
    model: anthropic('claude-sonnet-4-5-20250929'),
    instructions: `You are a weather expert researching ${city}. You MUST use the getLocalForecast tool to get the forecast, then summarize it.`,
    tools: {
      getLocalForecast: {
        description:
          'Get a detailed local weather forecast for a specific city and season',
        inputSchema: z.object({
          city: z.string().describe('The city to get the forecast for'),
          season: z
            .string()
            .describe('The current season (spring, summer, fall, winter)'),
        }),
        execute: async ({ city, season }: { city: string; season: string }) => {
          const forecastResult = await generateText({
            model: anthropic('claude-sonnet-4-5-20250929'),
            prompt: `Generate a realistic weather forecast for ${city} during ${season}. Include temperature in Celsius, humidity, wind speed, and a fun climate fact. Keep it to 2-3 sentences.`,
            telemetry: {
              functionId: `forecast-lookup-${city.toLowerCase()}`,
            },
          });
          return forecastResult.text;
        },
      },
    },
    telemetry: {
      functionId: `weather-subagent-${city.toLowerCase()}`,
    },
  });

const weatherAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  instructions:
    'You compare weather across cities. Use the researchCity tool for each city.',
  tools: {
    researchCity: {
      description:
        'Research detailed weather information for a city using a sub-agent',
      inputSchema: z.object({
        city: z.string().describe('The city to research'),
      }),
      execute: async ({ city }: { city: string }) => {
        const subAgent = createCityResearchAgent(city);
        const subResult = await subAgent.generate({
          prompt: `Research the current weather in ${city}. Use the getLocalForecast tool with the current season.`,
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
