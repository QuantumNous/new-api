import { google } from '@ai-sdk/google';
import { generateImage } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';
import { presentImages } from '../../lib/present-image';

run(async () => {
  const editResult = await generateImage({
    model: google.image('gemini-2.5-flash-image'),
    prompt: {
      text: 'Add a small wizard hat to this cat. Keep everything else the same.',
      images: [
        'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
      ],
    },
  });

  presentImages(editResult.images);
});
