import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { Output, isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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
    prompt: 'What is the weather in New York, Los Angeles, and Chicago?',
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'tool-call':
        console.log(`\n--- Tool Call: ${part.toolName} ---`);
        break;
      case 'tool-result':
        console.log(`--- Tool Result ---`);
        console.log(JSON.stringify(part.output, null, 2));
        break;
    }
  }

  console.log('\n\n--- Final ---');
  console.log('Output:', await result.output);
  console.log('Finish reason:', await result.finishReason);
});
