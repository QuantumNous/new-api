import { openai } from '@ai-sdk/openai';
import { tool, generateImage, type UIToolInvocation } from 'ai';
import { z } from 'zod';

export const generateImageTool = tool({
  description: 'Generate an image',
  inputSchema: z.object({}),
  async execute() {
    const result = await generateImage({
      model: openai.image('gpt-image-2'),
      prompt: 'A beautiful image of a sunset over a calm ocean',
    });

    return {
      mediaType: result.image.mediaType,
      base64: result.image.base64,
    };
  },
  toModelOutput: ({ output: { mediaType, base64 } }) => ({
    type: 'content',
    value: [{ type: 'file', mediaType, data: { type: 'data', data: base64 } }],
  }),
});

export type GenerateImageUIToolInvocation = UIToolInvocation<
  typeof generateImageTool
>;
