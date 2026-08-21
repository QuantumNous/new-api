import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    include: {
      rawChunks: true,
    },
    onChunk({ chunk }) {
      if (chunk.type === 'raw') {
        const raw = chunk.rawValue as Record<string, unknown>;
        if (raw.type === 'message_delta') {
          console.log('\n=== RAW message_delta ===');
          console.log(JSON.stringify(raw, null, 2));
        }
      }
    },
    model: anthropic('claude-sonnet-4-6'),
    messages: [
      { role: 'user', content: 'What is the weather in San Francisco?' },
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
              value: {
                temperature: 72,
                condition: 'sunny',
                humidity: 65,
                wind: '10 mph NW',
                pressure: '1013 hPa',
                visibility: '10 miles',
                uvIndex: 6,
                feelsLike: 74,
              },
            },
          },
        ],
      },
      { role: 'user', content: 'What about New York?' },
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
              value: {
                temperature: 65,
                condition: 'cloudy',
                humidity: 78,
                wind: '15 mph E',
                pressure: '1010 hPa',
                visibility: '8 miles',
                uvIndex: 3,
                feelsLike: 63,
              },
            },
          },
        ],
      },
      { role: 'user', content: 'What about Los Angeles?' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool_3',
            toolName: 'weather',
            input: { location: 'Los Angeles' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool_3',
            toolName: 'weather',
            output: {
              type: 'json',
              value: {
                temperature: 78,
                condition: 'sunny',
                humidity: 45,
                wind: '5 mph SW',
                pressure: '1015 hPa',
                visibility: '10 miles',
                uvIndex: 8,
                feelsLike: 80,
              },
            },
          },
        ],
      },
      { role: 'user', content: 'What about Chicago?' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool_4',
            toolName: 'weather',
            input: { location: 'Chicago' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool_4',
            toolName: 'weather',
            output: {
              type: 'json',
              value: {
                temperature: 55,
                condition: 'windy',
                humidity: 60,
                wind: '25 mph N',
                pressure: '1008 hPa',
                visibility: '10 miles',
                uvIndex: 4,
                feelsLike: 50,
              },
            },
          },
        ],
      },
      { role: 'user', content: 'What about Miami?' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool_5',
            toolName: 'weather',
            input: { location: 'Miami' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool_5',
            toolName: 'weather',
            output: {
              type: 'json',
              value: {
                temperature: 85,
                condition: 'humid',
                humidity: 90,
                wind: '8 mph SE',
                pressure: '1012 hPa',
                visibility: '9 miles',
                uvIndex: 10,
                feelsLike: 92,
              },
            },
          },
        ],
      },
      { role: 'user', content: 'What about Seattle?' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool_6',
            toolName: 'weather',
            input: { location: 'Seattle' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool_6',
            toolName: 'weather',
            output: {
              type: 'json',
              value: {
                temperature: 58,
                condition: 'rainy',
                humidity: 85,
                wind: '12 mph W',
                pressure: '1005 hPa',
                visibility: '5 miles',
                uvIndex: 2,
                feelsLike: 55,
              },
            },
          },
        ],
      },
      { role: 'user', content: 'compare all the cities briefly.' },
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
                value: 100,
              },
              keep: {
                type: 'tool_uses',
                value: 0,
              },
            },
          ],
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }

  console.log('\n');

  const providerMetadata = (await result.finalStep).providerMetadata;
  console.log('providerMetadata:', JSON.stringify(providerMetadata, null, 2));
  console.log(
    'contextManagement:',
    providerMetadata?.anthropic?.contextManagement,
  );
});
