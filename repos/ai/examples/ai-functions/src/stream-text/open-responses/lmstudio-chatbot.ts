import { createOpenResponses } from '@ai-sdk/open-responses';
import { isStepCount, streamText, APICallError, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

const lmstudio = createOpenResponses({
  name: 'lmstudio',
  url: 'http://localhost:1234/v1/responses',
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
      model: lmstudio('zai-org/glm-4.7-flash'),
      tools: { weather: weatherTool },
      instructions: `You are a helpful, respectful and honest assistant.`,
      stopWhen: isStepCount(5),
      messages,
      onError: ({ error }) => {
        console.log('onError');
        console.error(error);

        if (APICallError.isInstance(error)) {
          console.error(JSON.stringify(error.requestBodyValues, null, 2));
        }
      },
    });

    process.stdout.write('\nAssistant: ');
    for await (const chunk of result.stream) {
      switch (chunk.type) {
        case 'tool-call': {
          process.stdout.write('\x1b[33m');
          console.log('Tool call:', chunk.toolName);
          console.log('Tool args:', chunk.input);
          process.stdout.write('\x1b[0m');
          break;
        }

        case 'tool-result': {
          process.stdout.write('\x1b[33m');
          console.log('Tool result:', chunk.output);
          process.stdout.write('\x1b[0m');
          break;
        }

        case 'tool-error': {
          process.stdout.write('\x1b[0m');
          process.stderr.write('\x1b[31m');
          console.error('Tool error:', chunk.error);
          process.stderr.write('\x1b[0m');
          break;
        }

        case 'reasoning-start': {
          process.stdout.write('\x1b[34m');
          break;
        }

        case 'reasoning-delta': {
          process.stdout.write(chunk.text);
          break;
        }

        case 'reasoning-end': {
          process.stdout.write('\x1b[0m');
          console.log();
          break;
        }

        case 'text-start': {
          process.stdout.write('\x1b[32m');
          break;
        }

        case 'text-delta': {
          process.stdout.write(chunk.text);
          break;
        }

        case 'text-end': {
          process.stdout.write('\x1b[0m');
          console.log();
          break;
        }
      }
    }
    process.stdout.write('\n\n');

    messages.push(...(await result.response).messages);
  }
});
