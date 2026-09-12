import { openai } from '@ai-sdk/openai';
import { tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: openai('gpt-5-mini'),
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      contextSchema: z.object({
        apiKey: z.string().describe('The API key for the weather API'),
      }),
      execute: async ({ location }, { context: { apiKey } }) => {
        console.log('weather tool api key:', apiKey);

        return {
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        };
      },
    }),
  },
  callOptionsSchema: z.object({
    weatherApiKey: z.string(),
  }),
  toolsContext: {
    weather: { apiKey: 'not-set' },
  },
  prepareCall: ({ options, toolsContext, ...rest }) => ({
    ...rest,
    toolsContext: {
      ...toolsContext,
      weather: {
        apiKey: options.weatherApiKey,
      },
    },
  }),
  prepareStep: async ({ toolsContext }) => {
    console.log('prepareStep toolsContext:', toolsContext);
    return {};
  },
  instructions: 'You are a helpful assistant.',
});

run(async () => {
  const result = await agent.generate({
    prompt: 'What is the weather in San Francisco?',
    options: {
      weatherApiKey: 'weather-123',
    },
  });

  console.log(JSON.stringify(result.toolResults, null, 2));
});
