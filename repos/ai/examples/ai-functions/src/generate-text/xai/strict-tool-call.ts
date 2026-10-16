import { xai } from '@ai-sdk/xai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai('grok-4-1-fast-reasoning'),
    tools: {
      getWeather: tool({
        description: 'Get weather by city and unit',
        inputSchema: z.object({
          city: z.string(),
          unit: z.enum(['celsius', 'fahrenheit']),
        }),
        strict: true,
        execute: async ({ city, unit }) => {
          return { city, unit, temperature: 72 };
        },
      }),
    },
    prompt: 'What is the weather in Boston?',
  });

  console.log('Text:', result.text);
  console.log('Tool Calls:', JSON.stringify(result.toolCalls, null, 2));
  console.log('Tool Results:', JSON.stringify(result.toolResults, null, 2));
});
