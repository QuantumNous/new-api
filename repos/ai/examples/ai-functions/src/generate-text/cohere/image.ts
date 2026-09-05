import { cohere } from '@ai-sdk/cohere';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: cohere('command-a-vision-07-2025'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image',
            data: fs.readFileSync('./data/comic-cat.png').toString('base64'),
            providerOptions: {
              cohere: { detail: 'high' },
            },
          },
        ],
      },
    ],
  });

  console.log(result.text);
  console.log();
  console.log('Usage:', result.usage);
});
