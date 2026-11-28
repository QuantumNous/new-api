import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    messages: [
      {
        role: 'user',
        content: 'What is the weather in San Francisco?',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'The user wants weather data for San Francisco. I should call the weather tool.',
          },
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
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'The weather in San Francisco is 72°F and sunny.',
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
            type: 'reasoning',
            text: 'Now the user wants New York weather. I should call the weather tool again.',
          },
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
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'The weather in New York is 65°F and cloudy.',
          },
        ],
      },
      {
        role: 'user',
        content: 'Compare both cities.',
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
    reasoning: 'low',
    providerOptions: {
      anthropic: {
        contextManagement: {
          edits: [
            {
              type: 'clear_thinking_20251015',
              keep: { type: 'thinking_turns', value: 1 },
            },
            {
              type: 'clear_tool_uses_20250919',
              trigger: { type: 'tool_uses', value: 4 },
              keep: { type: 'tool_uses', value: 1 },
              clearToolInputs: true,
            },
          ],
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  console.log('Text:', result.text);

  const contextManagement = result.finalStep.providerMetadata?.anthropic
    ?.contextManagement as {
    appliedEdits: Array<{
      type: string;
      clearedToolUses?: number;
      clearedThinkingTurns?: number;
      clearedInputTokens?: number;
    }>;
  } | null;
  if (contextManagement?.appliedEdits?.length) {
    console.log('\nApplied edits:');
    for (const edit of contextManagement.appliedEdits) {
      if (edit.type === 'clear_tool_uses_20250919') {
        console.log(
          `  Cleared ${edit.clearedToolUses} tool uses (${edit.clearedInputTokens} tokens)`,
        );
      } else if (edit.type === 'clear_thinking_20251015') {
        console.log(
          `  Cleared ${edit.clearedThinkingTurns} thinking turns (${edit.clearedInputTokens} tokens)`,
        );
      }
    }
  }

  console.log('\nRequest body:', JSON.stringify(result.request.body, null, 2));
});
