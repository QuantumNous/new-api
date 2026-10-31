import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount, tool } from 'ai';
import * as z from 'zod';

async function main() {
  const result = await generateText({
    model: openai('gpt-4o'),
    prompt: 'What is the weather in San Francisco?',
    tools: {
      getWeather: tool({
        description: 'Get the weather for a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get weather for'),
        }),
        execute: async ({ location }) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { temperature: 72, condition: 'sunny', location };
        },
      }),
    },
    stopWhen: isStepCount(3),
    onStart: event => {
      console.log('\n--- onStart ---');
      console.log('Provider:', event.provider);
      console.log('Model:', event.modelId);
      console.log('Temperature:', event.temperature);
    },
    onStepStart: event => {
      console.log('\n--- onStepStart ---');
      console.log('Step:', event.steps.length);
      console.log('Message count:', event.messages.length);
    },
    onToolExecutionStart: event => {
      console.log('\n--- onToolExecutionStart ---');
      console.log('Tool:', event.toolCall.toolName);
      console.log('Input:', JSON.stringify(event.toolCall.input));
    },
    onToolExecutionEnd: event => {
      console.log('\n--- onToolExecutionEnd ---');
      console.log('Tool:', event.toolCall.toolName);
      console.log('Duration:', event.toolExecutionMs, 'ms');
      const success = event.toolOutput.type === 'tool-result';
      console.log('Success:', success);
      if (event.toolOutput.type === 'tool-result') {
        console.log('Output:', event.toolOutput.output);
      } else {
        console.log('Error:', event.toolOutput.error);
      }
    },
    onStepFinish: event => {
      console.log('\n--- onStepFinish ---');
      console.log('Step:', event.stepNumber);
      console.log('Finish reason:', event.finishReason);
      console.log('Input tokens:', event.usage.inputTokens);
      console.log('Output tokens:', event.usage.outputTokens);
    },
    onEnd: event => {
      console.log('\n--- onEnd ---');
      console.log('Total steps:', event.steps.length);
      console.log('Total input tokens:', event.usage.inputTokens);
      console.log('Total output tokens:', event.usage.outputTokens);
      console.log('Final text:', event.text);
    },
  });

  console.log('\n=== FINAL RESULT ===');
  console.log(result.text);
}

main().catch(console.error);
