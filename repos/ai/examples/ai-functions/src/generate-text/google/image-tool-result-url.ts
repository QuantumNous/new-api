import { google } from '@ai-sdk/google';
import { generateText, isStepCount, tool } from 'ai';
import { run } from '../../lib/run';
import { z } from 'zod';

run(async () => {
  const readImage = tool({
    description: `Read and return an image`,
    inputSchema: z.object({}),
    execute: async () => {
      return {
        description: 'Successfully loaded image',
        // This example currently does not work, neither with `google` nor with `vertex`, despite
        // https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/function-calling#functionresponsepart docs.
        // The API doesn't error, but the model clearly doesn't see the image because it makes up something else.
        imageUrl:
          'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/comic-cat.png?raw=true',
      };
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
