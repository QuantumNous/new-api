import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            data: fs.readFileSync('./data/comic-cat.png'),
            mediaType: 'image',
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
