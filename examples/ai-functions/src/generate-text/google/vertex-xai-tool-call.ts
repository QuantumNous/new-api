import { googleVertexXai } from '@ai-sdk/google-vertex/xai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: googleVertexXai('xai/grok-4.1-fast-reasoning'),
    tools: {
      weather: tool({
        description: 'Get the weather in a location (fahrenheit)',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        outputSchema: z.object({
          location: z.string(),
          temperature: z.number(),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        }),
      }),
    },
    prompt: 'What is the weather in San Francisco?',
  });

  console.log('Text:', result.text);
  console.log();
  console.log('Tool calls:', result.toolCalls);
  console.log('Tool results:', result.toolResults);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
