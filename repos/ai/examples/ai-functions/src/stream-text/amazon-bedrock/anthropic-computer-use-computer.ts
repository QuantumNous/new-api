import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { isStepCount, streamText } from 'ai';
import fs from 'fs';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    tools: {
      computer: bedrockAnthropic.tools.computer_20241022({
        displayWidthPx: 1024,
        displayHeightPx: 768,
        async execute({ action, coordinate, text }) {
          console.log(`Computer action: ${action}`, { coordinate, text });

          if (action === 'screenshot') {
            return {
              type: 'file',
              mediaType: 'image',
              data: fs
                .readFileSync('./data/screenshot-editor.png')
                .toString('base64'),
            };
          }

          return `executed ${action}`;
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
    prompt: 'Take a screenshot of my screen and describe what you see.',
    stopWhen: isStepCount(3),
  });

  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    } else if (part.type === 'tool-call') {
      console.log(
        `\nTool call: ${part.toolName}(${JSON.stringify(part.input).substring(0, 50)}...)`,
      );
    } else if (part.type === 'tool-result') {
      console.log(`Tool result received`);
    }
  }

  console.log();
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
});
