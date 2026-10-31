import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    messages: [
      {
        role: 'user',
        content: 'What is the weather in San Francisco?',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool_1',
            toolName: 'weather',
            input: { location: 'San Francisco' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool_1',
            toolName: 'weather',
            output: {
              type: 'json',
              value: { temperature: 72, condition: 'sunny' },
            },
          },
        ],
      },
      {
        role: 'user',
        content: 'What about New York?',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool_2',
            toolName: 'weather',
            input: { location: 'New York' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool_2',
            toolName: 'weather',
            output: {
              type: 'json',
              value: { temperature: 65, condition: 'cloudy' },
            },
          },
        ],
      },
      {
        role: 'user',
        content: 'compare the two cities.',
      },
    ],
    tools: {
      weather: tool({
        description: 'Get the weather of a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
          condition: 'sunny',
        }),
      }),
    },
    providerOptions: {
      anthropic: {
        contextManagement: {
          edits: [
            {
              type: 'clear_tool_uses_20250919',
              trigger: {
                type: 'input_tokens',
                value: 1000,
              },
              keep: {
                type: 'tool_uses',
                value: 1,
              },
              clearAtLeast: {
                type: 'input_tokens',
                value: 500,
              },
              clearToolInputs: true,
              excludeTools: ['important_tool'],
            },
          ],
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  console.log('request body:', JSON.stringify(result.request.body, null, 2));
});
