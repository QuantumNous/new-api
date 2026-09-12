import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: amazonBedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please download this image https://upload.wikimedia.org/wikipedia/commons/f/f8/Alan_Turing_%281951%29.jpg and tell me what you see',
          },
        ],
      },
    ],
    tools: {
      submit: tool({
        description: 'Download an image',
        inputSchema: z.object({
          url: z.string().describe('The image URL'),
        }),
        execute: async ({ url }) => {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          return { bytes };
        },
        toModelOutput({ output }) {
          return {
            type: 'content',
            value: [
              {
                type: 'file',
                mediaType: 'image/jpeg',
                data: {
                  type: 'data',
                  data: Buffer.from(output.bytes).toString('base64'),
                },
              },
            ],
          };
        },
      }),
    },
    stopWhen: isStepCount(5),
  });

  console.log(result.text);
});
