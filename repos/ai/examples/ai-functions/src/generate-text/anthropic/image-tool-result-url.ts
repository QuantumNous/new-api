import { generateText, isStepCount, tool } from 'ai';
import { run } from '../../lib/run';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';

run(async () => {
  const readImage = tool({
    description: `Read and return an image`,
    inputSchema: z.object({}),
    execute: async () => {
      try {
        return {
          success: true,
          description: 'Successfully loaded image',
          imageUrl:
            'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/comic-cat.png?raw=true',
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
    model: anthropic('claude-sonnet-4-0'),
    prompt:
      'Please read the image using the tool provided and return the summary of that image',
    tools: {
      readImage,
    },
    stopWhen: isStepCount(4),
  });

  console.log(`Assistant response : ${JSON.stringify(result.text, null, 2)}`);
});
