import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { readFile } from 'node:fs/promises';
import { run } from '../../lib/run';

run(async () => {
  const bytes = new Uint8Array(await readFile('./data/comic-cat.png'));

  const result = await generateText({
    model: openai('gpt-4o'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image/png',
            data: { type: 'data', data: bytes },
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
