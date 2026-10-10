import { tool } from 'ai';
import { z } from 'zod';

export const tools = {
  weather: tool({
    description: 'Get the weather in a location',
    inputSchema: z.object({
      location: z.string().describe('The location to get the weather for'),
    }),
    execute: async ({ location }) => ({
      location,
      temperature: 72 + Math.floor(Math.random() * 21) - 10,
    }),
  }),
  convertTemperature: tool({
    description: 'Convert temperature between Fahrenheit and Celsius',
    inputSchema: z.object({
      temperature: z.number().describe('The temperature value to convert'),
      from: z
        .enum(['fahrenheit', 'celsius'])
        .describe('The unit to convert from'),
      to: z.enum(['fahrenheit', 'celsius']).describe('The unit to convert to'),
    }),
    execute: async ({ temperature, from, to }) => {
      if (from === to) {
        return { temperature, unit: to };
      }

      let result: number;
      if (from === 'celsius' && to === 'fahrenheit') {
        result = (temperature * 9) / 5 + 32;
      } else {
        result = ((temperature - 32) * 5) / 9;
      }

      return {
        original: temperature,
        originalUnit: from,
        converted: Math.round(result * 100) / 100,
        convertedUnit: to,
      };
    },
  }),
};
