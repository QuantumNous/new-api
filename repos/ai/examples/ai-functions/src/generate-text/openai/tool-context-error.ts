import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';

async function main() {
  await generateText({
    model: openai('gpt-4o-mini'),
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        contextSchema: z.object({
          apiKey: z.string(),
        }),
        execute: async ({ location }, { context }) => ({
          location,
          apiKeyPrefix: context.apiKey.slice(0, 3),
        }),
      }),
    },
    toolChoice: {
      type: 'tool',
      toolName: 'weather',
    },
    // Intentionally bypass the static type so the runtime validator throws.
    toolsContext: { weather: { apiKey: 123 } } as any,
    prompt: 'What is the weather in San Francisco?',
  });

  throw new Error('Expected TypeValidationError to be thrown.');
}

main().catch(error => {
  throw error;
});
