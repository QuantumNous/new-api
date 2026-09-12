// @ts-nocheck
import { tool } from 'ai';
import { z } from 'zod';

// Using tool() function
const weatherTool = tool({
  description: 'Get weather for a location',
  inputSchema: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return `Weather in ${location}`;
  },
});

// In tools object
const tools = {
  weather: {
    description: 'Get weather information',
    inputSchema: z.object({
      city: z.string(),
    }),
    execute: async ({ city }) => {
      return `Weather in ${city}`;
    },
  },
  search: {
    description: 'Search the web',
    inputSchema: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      return `Search results for ${query}`;
    },
  },
}; 