import { mistral } from '@ai-sdk/mistral';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: mistral('pixtral-large-latest'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image',
            data: fs.readFileSync('./data/comic-cat.png').toString('base64'),
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
