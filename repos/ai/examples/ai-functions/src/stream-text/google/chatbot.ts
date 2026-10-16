import { google } from '@ai-sdk/google';
import { isStepCount, streamText, tool, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { z } from 'zod';
import { run } from '../../lib/run';

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

run(async () => {
  while (true) {
    messages.push({ role: 'user', content: await terminal.question('You: ') });

    const result = streamText({
      model: google('gemini-2.5-flash'),
      tools: {
        weather: tool({
          description: 'Get the weather in a location',
          inputSchema: z.object({
            location: z
              .string()
              .describe('The location to get the weather for'),
          }),
          execute: async ({ location }) => ({
            location,
            temperature: 72 + Math.floor(Math.random() * 21) - 10,
          }),
        }),
        // Test tool with multiple types (tests the anyOf conversion fix)
        calculate: tool({
          description:
            'Perform a calculation with a value that can be string or number',
          inputSchema: z.object({
            value: z
              .union([z.string(), z.number()])
              .describe('A value that can be either a string or a number'),
            operation: z
              .enum(['double', 'triple'])
              .describe('The operation to perform'),
          }),
          execute: async ({ value, operation }) => {
            const numValue =
              typeof value === 'string' ? parseFloat(value) : value;
            const multiplier = operation === 'double' ? 2 : 3;
            return {
              input: value,
              result: numValue * multiplier,
              operation,
            };
          },
        }),
      },
      stopWhen: isStepCount(5),
      messages,
    });

    process.stdout.write('\nAssistant: ');
    for await (const delta of result.textStream) {
      process.stdout.write(delta);
    }
    process.stdout.write('\n\n');

    messages.push(...(await result.response).messages);
  }
});
