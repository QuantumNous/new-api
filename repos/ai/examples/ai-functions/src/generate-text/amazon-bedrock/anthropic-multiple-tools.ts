import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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
      calculator: tool({
        description: 'Perform a calculation',
        inputSchema: z.object({
          expression: z.string().describe('The math expression to evaluate'),
        }),
        execute: async ({ expression }) => ({
          expression,
          result: eval(expression),
        }),
      }),
    },
    prompt:
      'What is the weather in San Francisco? Also, what is the stock price of AAPL? Finally, calculate 25 * 4.',
  });

  console.log('Text:', result.text);
  console.log('Tool calls:', JSON.stringify(result.toolCalls, null, 2));
  console.log('Tool results:', JSON.stringify(result.toolResults, null, 2));
  console.log('Finish reason:', result.finishReason);
});
