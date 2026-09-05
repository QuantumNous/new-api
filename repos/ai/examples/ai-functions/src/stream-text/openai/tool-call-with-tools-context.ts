import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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
      calculator: tool({
        description: 'Calculate mathematical expressions',
        inputSchema: z.object({
          expression: z
            .string()
            .describe('The mathematical expression to calculate'),
        }),
        contextSchema: z.object({
          apiKey: z.string().describe('The API key for the calculator API'),
        }),
        execute: async ({ expression }, { context: { apiKey } }) => {
          console.log('calculator tool api key:', apiKey);

          return {
            expression,
            result: eval(expression),
          };
        },
      }),
    },
    toolsContext: {
      weather: { apiKey: 'weather-123' },
      calculator: { apiKey: 'calculator-456' },
    },
    prepareStep: async ({ toolsContext }) => {
      console.log('prepareStep toolsContext:', toolsContext);
      return {};
    },
    prompt: 'What is the weather in San Francisco?',
  });

  await printFullStream({ result });
});
