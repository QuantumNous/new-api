import { google, type GoogleEmbeddingModelOptions } from '@ai-sdk/google';
import { embedMany } from 'ai';
import { readFileSync } from 'fs';
import { run } from '../../lib/run';

run(async () => {
  const imageData = readFileSync('./data/comic-cat.png').toString('base64');

  const { embeddings, usage, warnings } = await embedMany({
    model: google.embeddingModel('gemini-embedding-2-preview'),
    values: [
      'sunny day at the beach',
      'rainy afternoon in the city',
      'snowy night in the mountains',
    ],
    providerOptions: {
      google: {
        content: [
          [
            {
              inlineData: {
                mimeType: 'image/png',
                data: imageData,
              },
            },
          ],
          null,
          [
            {
              inlineData: {
                mimeType: 'image/png',
                data: imageData,
              },
            },
          ],
        ],
      } satisfies GoogleEmbeddingModelOptions,
    },
  });

  console.log(embeddings);
  console.log(usage);
  console.log(warnings);
});
