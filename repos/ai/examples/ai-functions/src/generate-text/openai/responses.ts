import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const screenshot = fs
    .readFileSync('./data/screenshot-editor.png')
    .toString('base64');

  const result = await generateText({
    model: openai.responses('gpt-5.4'),
    tools: {
      computer: openai.tools.computer({
        needsApproval: ({ pendingSafetyChecks }) =>
          pendingSafetyChecks.length > 0,
        execute: async ({ actions, pendingSafetyChecks }) => {
          // Replace this logging with an isolated browser or VM harness that
          // executes every action in order.
          for (const action of actions) {
            console.log('Computer action:', action);
          }

          return {
            output: {
              type: 'computer_screenshot',
              imageUrl: `data:image/png;base64,${screenshot}`,
              detail: 'original',
            },
            acknowledgedSafetyChecks: pendingSafetyChecks,
          };
        },
      }),
    },
    prompt:
      'Inspect the current screen and describe the editor. Do not change anything.',
    stopWhen: isStepCount(3),
  });

  console.log(result.text);
  console.log('Finish reason:', result.finishReason);
  console.log('Tool calls:', JSON.stringify(result.toolCalls, null, 2));
});
