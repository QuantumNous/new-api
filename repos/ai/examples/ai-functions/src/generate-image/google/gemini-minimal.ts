import { google } from '@ai-sdk/google';
import { generateImage } from 'ai';
import { run } from '../../lib/run';
import { presentImages } from '../../lib/present-image';

run(async () => {
  const { images } = await generateImage({
    model: google.image('gemini-2.5-flash-image'),
    prompt: 'A nano banana in a fancy restaurant',
  });

  presentImages(images);
});
