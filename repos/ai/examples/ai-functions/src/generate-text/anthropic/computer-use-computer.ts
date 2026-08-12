import { anthropic } from '@ai-sdk/anthropic';
import { generateText, isStepCount } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    tools: {
      computer: anthropic.tools.computer_20241022({
        displayWidthPx: 1024,
        displayHeightPx: 768,

        async execute({ action, coordinate, text }) {
          console.log('args', { action, coordinate, text });
          switch (action) {
            case 'screenshot': {
              // multipart result:
              return {
                type: 'file',
                mediaType: 'image',
                data: fs
                  .readFileSync('./data/screenshot-editor.png')
                  .toString('base64'),
              };
            }
            default: {
              console.log('Action:', action);
              console.log('Coordinate:', coordinate);
              console.log('Text:', text);
              return `executed ${action}`;
            }
          }
        },

        // map to tool result content for LLM consumption:
        toModelOutput({ output }) {
          return {
            type: 'content',
            value: [
              typeof output === 'string'
                ? { type: 'text', text: output }
                : {
                    type: 'file',
                    mediaType: 'image/png',
                    data: { type: 'data', data: output.data },
                  },
            ],
          };
        },
      }),
    },
    prompt:
      'How can I switch to dark mode? Take a look at the screen and tell me.',
    stopWhen: isStepCount(5),
  });

  console.log(result.text);
  console.log(result.finishReason);
  console.log(JSON.stringify(result.toolCalls, null, 2));
});
