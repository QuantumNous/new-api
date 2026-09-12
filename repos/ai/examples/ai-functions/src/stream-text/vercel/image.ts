import { vercel } from '@ai-sdk/vercel';
import { streamText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: vercel('v0-1.0-md'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image',
            data: fs.readFileSync('./data/comic-cat.png'),
          },
        ],
      },
    ],
    onError: error => {
      console.error(error);
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
});
