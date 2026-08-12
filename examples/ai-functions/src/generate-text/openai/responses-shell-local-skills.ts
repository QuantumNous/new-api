import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount } from 'ai';
import { resolve } from 'path';
import { executeShellCommand } from '../../lib/shell-executor';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-5.4'),
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
        environment: {
          type: 'local',
          skills: [
            {
              name: 'island-rescue',
              description: 'How to be rescued from a lonely island',
              path: resolve('data/island-rescue'),
            },
          ],
        },
      }),
    },
    prompt:
      'You are trapped and lost on a lonely island in 1895. Find a way to get rescued!',
    stopWhen: isStepCount(5),
  });

  console.log('Result:', result.text);
});
