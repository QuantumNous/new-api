import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { isStepCount, streamText, tool, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { z } from 'zod';
import { run } from '../../lib/run';

const bedrock = createAmazonBedrock({
  // example fetch wrapper that logs the input to the API call:
  fetch: async (url: RequestInfo | URL, options?: RequestInit) => {
    console.log('URL', url);
    console.log('Headers', JSON.stringify(options!.headers, null, 2));
    console.log(
      `Body ${JSON.stringify(JSON.parse(options!.body! as string), null, 2)}`,
    );
    return await fetch(url, options);
  },
});

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

run(async () => {
  while (true) {
    const userInput = await terminal.question('You: ');

    messages.push({ role: 'user', content: userInput });

    const result = streamText({
      model: bedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
      messages,
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
      },
      stopWhen: isStepCount(5),
      maxRetries: 0,
      reasoning: 'low',
      onError: error => {
        console.error(error);
      },
    });

    process.stdout.write('\nAssistant: ');
    for await (const part of result.stream) {
      if (part.type === 'reasoning-delta') {
        process.stdout.write('\x1b[34m' + part.text + '\x1b[0m');
      } else if (part.type === 'text-delta') {
        process.stdout.write(part.text);
      }
    }
    process.stdout.write('\n\n');

    messages.push(...(await result.response).messages);
  }
});
