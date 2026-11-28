import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    maxOutputTokens: 1024,
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
          unit: 'fahrenheit',
        }),
      }),
      stockPrice: tool({
        description: 'Get the current stock price',
        inputSchema: z.object({
          symbol: z.string().describe('The stock symbol'),
        }),
        execute: async ({ symbol }) => ({
          symbol,
          price: 150 + Math.floor(Math.random() * 50),
          currency: 'USD',
        }),
      }),
    },
    prompt:
      'What is the weather in Tokyo? Also, what is the stock price of GOOGL?',
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'tool-call':
        console.log(`\n--- Tool Call: ${part.toolName} ---`);
        console.log('Input:', JSON.stringify(part.input, null, 2));
        break;
      case 'tool-result':
        console.log(`--- Tool Result: ${part.toolName} ---`);
        console.log('Output:', JSON.stringify(part.output, null, 2));
        break;
    }
  }

  console.log('\n\n--- Final ---');
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
});
