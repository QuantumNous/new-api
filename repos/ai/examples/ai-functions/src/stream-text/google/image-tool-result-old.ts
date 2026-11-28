import { google } from '@ai-sdk/google';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { run } from '../../lib/run';

async function fileToBase64(filePath: string): Promise<string> {
  const fileBuffer = await fs.promises.readFile(filePath);
  return fileBuffer.toString('base64');
}

const imageAnalysisTool = tool({
  description: 'Give the image ',
  inputSchema: z.object({}),
  execute: async ({}) => {
    try {
      const imagePath = path.join(__dirname, '../../../data/comic-cat.png');
      const base64Image = await fileToBase64(imagePath);

      return {
        success: true,
        description: 'Image fetched successfully',
        base64Image,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  toModelOutput({ output }) {
    return {
      type: 'content',
      value: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: { type: 'data', data: output.base64Image! },
        },
      ],
    };
  },
});

run(async () => {
  console.log(
    '🔍 Testing Google model image analysis with tool-returned images...\n',
  );

  const result = streamText({
    model: google('gemini-2.5-flash'),
    tools: {
      analyzeImage: imageAnalysisTool,
    },
    stopWhen: isStepCount(2),
    prompt: `Whats in this image?`,
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
