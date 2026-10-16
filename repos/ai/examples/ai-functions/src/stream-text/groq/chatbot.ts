import { groq } from '@ai-sdk/groq';
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
    const userInput = await terminal.question('You: ');

    messages.push({ role: 'user', content: userInput });

    const result = streamText({
      model: groq('openai/gpt-oss-120b'),
      onError(error) {
        console.error(error);
      },
      instructions: `You are a helpful, respectful and honest assistant.`,
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
      messages,
      onStepFinish(step) {
        console.log(
          JSON.stringify(JSON.parse(step.request.body as string), null, 2),
        );
      },
    });

    process.stdout.write('\nAssistant: ');
    for await (const chunk of result.stream) {
      switch (chunk.type) {
        case 'raw':
          console.log(JSON.stringify(chunk.rawValue, null, 2));
          break;

        case 'reasoning-start':
          process.stdout.write('\x1b[34m');
          break;

        case 'reasoning-delta':
          process.stdout.write(chunk.text);
          break;

        case 'reasoning-end':
          process.stdout.write('\x1b[0m');
          process.stdout.write('\n');
          break;

        case 'tool-input-start':
          process.stdout.write('\x1b[33m');
          console.log('Tool call:', chunk.toolName);
          process.stdout.write('Tool args: ');
          break;

        case 'tool-input-delta':
          process.stdout.write(chunk.delta);
          break;

        case 'tool-input-end':
          console.log();
          break;

        case 'tool-result':
          console.log('Tool result:', chunk.output);
          process.stdout.write('\x1b[0m');
          break;

        case 'tool-error':
          process.stdout.write('\x1b[0m');
          process.stderr.write('\x1b[31m');
          console.error('Tool error:', chunk.error);
          process.stderr.write('\x1b[0m');
          break;

        case 'text-start':
          process.stdout.write('\x1b[32m');
          break;

        case 'text-delta':
          process.stdout.write(chunk.text);
          break;

        case 'text-end':
          process.stdout.write('\x1b[0m');
          console.log();
          break;
      }
    }
    process.stdout.write('\n\n');

    messages.push(...(await result.response).messages);
  }
});
