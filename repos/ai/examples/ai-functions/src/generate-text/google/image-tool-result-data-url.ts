import { google } from '@ai-sdk/google';
import { generateText, isStepCount, tool } from 'ai';
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

  const result = await generateText({
    model: google('gemini-3-flash-preview'),
    prompt:
      'Please read the image using the tool provided and return the summary of that image',
    tools: {
      readImage,
    },
    stopWhen: isStepCount(4),
  });

  console.log(`Assistant response : ${JSON.stringify(result.text, null, 2)}`);
});
