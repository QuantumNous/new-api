import { luma } from '@ai-sdk/luma';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: luma.image('photon-flash-1'),
    prompt: 'A salamander at dusk in a forest pond, in the style of ukiyo-e',
    aspectRatio: '1:1',
  });

  await presentImages(result.images);
});
