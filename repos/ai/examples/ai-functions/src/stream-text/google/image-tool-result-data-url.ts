import { google } from '@ai-sdk/google';
import { isStepCount, streamText, tool } from 'ai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../../lib/run';
import { z } from 'zod';

run(async () => {
  const readImage = tool({
    description: `Read and return an image`,
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const imagePath = path.join(__dirname, '../../../data/comic-cat.png');
        const imageData = await fs.readFile(imagePath);
        const base64Data = imageData.toString('base64');

        return {
          success: true,
          description: 'Successfully loaded image',
          imageUrl: `data:image/png;base64,${base64Data}`,
        };
      } catch (error) {
        throw new Error(`Failed to analyze image: ${error}`);
      }
    },
    toModelOutput({ output }) {
      return {
        type: 'content',
        value: [
          {
            type: 'text',
            text: output.description,
          },
          {
            type: 'file',
            mediaType: 'image/png',
            data: { type: 'url', url: new URL(output.imageUrl) },
          },
        ],
      };
    },
  });

  const result = streamText({
    model: google('gemini-3-flash-preview'),
    prompt:
      'Please read the image using the tool provided and return the summary of that image',
    tools: {
      readImage,
    },
    stopWhen: isStepCount(4),
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'tool-call':
        process.stdout.write(
          `Tool call: ${part.toolName}(${JSON.stringify(part.input)})\n`,
        );
        break;
      case 'tool-result':
        process.stdout.write(
          `Tool result: ${part.toolName} -> ${JSON.stringify(part.output)}\n`,
        );
        break;
      case 'finish-step':
        process.stdout.write('\n');
        process.stdout.write(`Finish step: ${part.finishReason}\n`);
        break;
      case 'finish':
        process.stdout.write('\n');
        process.stdout.write(`Finish reason: ${part.finishReason}\n`);
        break;
      case 'error':
        process.stderr.write(`Error: ${part.error}\n`);
        break;
    }
  }
});
