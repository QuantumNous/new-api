import { anthropic } from '@ai-sdk/anthropic';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

const conditions = [
  { name: 'sunny', minTemperature: -5, maxTemperature: 35 },
  { name: 'snowy', minTemperature: -10, maxTemperature: 0 },
  { name: 'rainy', minTemperature: 0, maxTemperature: 15 },
  { name: 'cloudy', minTemperature: 5, maxTemperature: 25 },
];

run(async () => {
  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    stopWhen: isStepCount(5),
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        outputSchema: z.object({
          location: z.string(),
          condition: z.string(),
          temperature: z.number(),
        }),
        execute: async ({ location }) => {
          const condition =
            conditions[Math.floor(Math.random() * conditions.length)];
          return {
            location,
            condition: condition.name,
            temperature:
              Math.floor(
                Math.random() *
                  (condition.maxTemperature - condition.minTemperature + 1),
              ) + condition.minTemperature,
          };
        },
        strict: true,
      }),
    },
    prompt: 'What is the weather in San Francisco?',
  });

  await printFullStream({ result });
});
