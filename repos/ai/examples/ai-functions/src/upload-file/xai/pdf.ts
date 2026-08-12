import { xai } from '@ai-sdk/xai';
import { generateText, uploadFile } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const { providerReference, mediaType, filename, providerMetadata } =
    await uploadFile({
      api: xai.files(),
      data: fs.readFileSync('./data/ai.pdf'),
      filename: 'ai.pdf',
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
            text: 'Summarize the key points from this document.',
          },
          {
            type: 'file',
            data: providerReference,
            mediaType: 'application/pdf',
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
