import { xai } from '@ai-sdk/xai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { images } = await generateImage({
    model: xai.image('grok-imagine-image'),
    n: 3,
    prompt: 'A chicken flying into the sunset in the style of anime.',
  });

  await presentImages(images);
});
