import { google } from '@ai-sdk/google';
import { generateText, uploadFile } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const { providerReference, mediaType, filename, providerMetadata } =
    await uploadFile({
      api: google.files(),
      data: fs.readFileSync('./data/compaction-data.txt'),
    });

  console.log('Provider reference:', providerReference);
  console.log('Media type:', mediaType);
  console.log('Filename:', filename);
  console.log('Provider metadata:', providerMetadata);

  const result = await generateText({
    model: google('gemini-2.5-flash'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What topics does this document cover?',
          },
          {
            type: 'file',
            data: providerReference,
            mediaType: String(
              providerMetadata?.google?.mimeType || 'text/plain',
            ),
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
