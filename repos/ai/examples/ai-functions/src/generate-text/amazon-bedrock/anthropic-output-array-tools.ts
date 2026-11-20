import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText, Output, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    stopWhen: isStepCount(20),
    output: Output.array({
      element: z.object({
        location: z.string(),
        temperature: z.number(),
        condition: z.string(),
      }),
    }),
    tools: {
      weather: tool({
        description: 'Get the weather for a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: Math.floor(Math.random() * 30) + 50,
          condition: ['sunny', 'cloudy', 'rainy'][
            Math.floor(Math.random() * 3)
          ],
        }),
      }),
    },
    prompt: 'What is the weather in San Francisco, London, Paris, and Berlin?',
  });

  console.log('Output:', JSON.stringify(result.output, null, 2));
  console.log('Steps:', result.steps.length);
  console.log('Finish reason:', result.finishReason);
});
