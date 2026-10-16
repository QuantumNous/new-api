import { openai } from '@ai-sdk/openai';
import { tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  instructions: 'You are a helpful assistant that can look up weather.',
  tools: {
    weather: tool({
      description: 'Get the weather for a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get weather for'),
      }),
      execute: ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
        condition: 'sunny',
      }),
    }),
  },
});

run(async () => {
  const result = await agent.generate({
    prompt: 'What is the weather in San Francisco and New York?',
    onStepFinish: async ({ text, finishReason, usage, toolCalls }) => {
      console.log('\n--- Step Finished ---');
      console.log('Finish Reason:', finishReason);
      console.log('Token Usage:', {
        input: usage.inputTokens,
        output: usage.outputTokens,
        total: usage.totalTokens,
      });

      if (toolCalls && toolCalls.length > 0) {
        console.log(
          'Tool Calls:',
          toolCalls.map(tc => tc.toolName),
        );
      }

      if (text) {
        console.log(
          'Text:',
          text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        );
      }
    },
  });

  console.log('\n=== Final Result ===');
  console.log('Total Steps:', result.steps.length);
  console.log('Final Text:', result.text);
});
