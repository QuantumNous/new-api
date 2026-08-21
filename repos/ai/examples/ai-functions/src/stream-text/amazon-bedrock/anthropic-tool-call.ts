import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { streamText, tool } from 'ai';
import 'dotenv/config';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    tools: {
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
    },
    prompt: 'What is the weather in San Francisco?',
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'tool-call':
        console.log('\n--- Tool Call ---');
        console.log('Tool:', part.toolName);
        console.log('Args:', JSON.stringify(part.input));
        break;
      case 'tool-result':
        console.log('\n--- Tool Result ---');
        console.log('Result:', JSON.stringify(part.output));
        break;
    }
  }

  console.log('\n\n--- Final ---');
  console.log('Text:', await result.text);
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
});
