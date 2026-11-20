import { tool } from 'ai';
import { z } from 'zod';

const conditions = [
  { name: 'sunny', minTemperature: -5, maxTemperature: 35 },
  { name: 'snowy', minTemperature: -10, maxTemperature: 0 },
  { name: 'rainy', minTemperature: 0, maxTemperature: 15 },
  { name: 'cloudy', minTemperature: 5, maxTemperature: 25 },
];

export const weatherTool = tool({
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
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
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
});
