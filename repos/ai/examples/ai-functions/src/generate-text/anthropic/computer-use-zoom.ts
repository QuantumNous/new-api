import { anthropic } from '@ai-sdk/anthropic';
import { generateText, isStepCount } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-opus-4-5-20251101'),
    tools: {
      computer: anthropic.tools.computer_20251124({
        displayWidthPx: 1024,
        displayHeightPx: 768,
        enableZoom: true,

        async execute({ action, coordinate, text, region }) {
          console.log('args', { action, coordinate, text, region });
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
            case 'zoom': {
              console.log('Zooming into region:', region);
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
      'Look at the screen and zoom in on any text that looks small or hard to read.',
    stopWhen: isStepCount(5),
  });

  console.log(result.text);
  console.log(result.finishReason);
  console.log(JSON.stringify(result.toolCalls, null, 2));
});
