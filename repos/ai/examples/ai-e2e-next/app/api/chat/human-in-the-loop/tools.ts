import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

const getWeatherInformation = tool({
  description: 'show the weather in a given city to the user',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.string(), // must define outputSchema
  // no execute function, we want human in the loop
});

const getLocalTime = tool({
  description: 'get the local time for a specified location',
  inputSchema: z.object({ location: z.string() }),
  // including execute function -> no confirmation required
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return '10am';
  },
});

export const tools = {
  getWeatherInformation,
  getLocalTime,
} satisfies ToolSet;
