import { xai } from '@ai-sdk/xai';
import { generateText, uploadFile } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const { providerReference, mediaType, filename, providerMetadata } =
    await uploadFile({
      api: xai.files(),
      data: fs.readFileSync('./data/comic-cat.png'),
      filename: 'comic-cat.png',
    });

  console.log('Provider reference:', providerReference);
  console.log('Media type:', mediaType);
  console.log('Filename:', filename);
  console.log('Provider metadata:', providerMetadata);

  const result = await generateText({
    model: xai.responses('grok-4'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe what you see in this image.',
          },
          {
            type: 'file',
            mediaType: 'image',
            data: providerReference,
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
