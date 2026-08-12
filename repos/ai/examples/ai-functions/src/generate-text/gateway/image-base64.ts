import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: 'xai/grok-3',
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
