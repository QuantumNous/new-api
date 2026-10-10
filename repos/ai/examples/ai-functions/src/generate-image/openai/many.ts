import { openai } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { images } = await generateImage({
    model: openai.image('dall-e-3'),
    n: 3, // 3 calls; dall-e-3 can only generate 1 image at a time
    prompt: 'Santa Claus driving a Cadillac',
  });

  await presentImages(images);
});
