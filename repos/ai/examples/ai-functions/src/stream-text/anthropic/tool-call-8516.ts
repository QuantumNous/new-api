import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import { print } from '../../lib/print';
import { z } from 'zod';

run(async () => {
  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'weather for berlin, london and paris' },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I will use the weather tool to get the weather for berlin, london and paris',
          },
          {
            type: 'tool-call',
            toolName: 'weather',
            toolCallId: 'weather-call-1',
            input: { location: 'berlin' },
          },
          {
            type: 'tool-call',
            toolName: 'weather',
            toolCallId: 'weather-call-2',
            input: { location: 'london' },
          },
          {
            type: 'tool-call',
            toolName: 'weather',
            toolCallId: 'weather-call-3',
            input: { location: 'paris' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolName: 'weather',
            toolCallId: 'weather-call-1',
            output: {
              type: 'json',
              value: { weather: 'sunny' },
            },
          },
          {
            type: 'tool-result',
            toolName: 'weather',
            toolCallId: 'weather-call-2',
            output: {
              type: 'json',
              value: { weather: 'cloudy' },
            },
          },
          {
            type: 'tool-result',
            toolName: 'weather',
            toolCallId: 'weather-call-3',
            output: {
              type: 'json',
              value: { weather: 'rainy' },
            },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'The weather for berlin is sunny, the weather for london is cloudy, and the weather for paris is rainy',
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'and for new york?' }],
      },
    ],
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async () => ({ weather: 'cloudy' }),
      }),
    },
  });

  await printFullStream({ result });
  console.log();
  print('Request body:', (await result.request).body);
});
