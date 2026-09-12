import { openai } from '@ai-sdk/openai';
import { generateText, uploadFile } from 'ai';
import { readFile } from 'node:fs/promises';
import { run } from '../../lib/run';

run(async () => {
  const { providerReference, mediaType, filename } = await uploadFile({
    api: openai.files(),
    data: await readFile('./data/comic-cat.png'),
    filename: 'comic-cat.png',
  });

  console.log('Provider reference:', providerReference);
  console.log('Media type:', mediaType);
  console.log('Filename:', filename);

  const result = await generateText({
    model: openai.responses('gpt-4o-mini'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe what you see in this image.' },
          {
            type: 'file',
            mediaType: mediaType ?? 'image/png',
            data: { type: 'reference', reference: providerReference },
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
