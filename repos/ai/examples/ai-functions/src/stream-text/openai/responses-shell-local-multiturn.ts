import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount, streamText } from 'ai';
import { executeShellCommand } from '../../lib/shell-executor';
import { run } from '../../lib/run';

run(async () => {
  const result1 = await generateText({
    model: openai.responses('gpt-5.6'),
    tools: {
      shell: openai.tools.shell({
        execute: async ({ action }) => {
          const outputs = await Promise.all(
            action.commands.map(command =>
              executeShellCommand(command, action.timeoutMs),
            ),
          );
          return { output: outputs };
        },
      }),
    },
    prompt: 'Run uname -a',
    stopWhen: isStepCount(5),
  });

  console.log('Turn 1:', result1.text);

  const result2 = streamText({
    model: openai.responses('gpt-5.6'),
    tools: {
      shell: openai.tools.shell({
        execute: async ({ action }) => {
          const outputs = await Promise.all(
            action.commands.map(command =>
              executeShellCommand(command, action.timeoutMs),
            ),
          );
          return { output: outputs };
        },
      }),
    },
    messages: [
      { role: 'user', content: 'Run uname -a' },
      ...result1.responseMessages,
      { role: 'user', content: 'What architecture do you run in?' },
    ],
    stopWhen: isStepCount(5),
  });

  for await (const chunk of result2.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-call': {
        console.log(
          `\x1b[32m\x1b[1mTool call:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'tool-result': {
        console.log(
          `\x1b[32m\x1b[1mTool result:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
