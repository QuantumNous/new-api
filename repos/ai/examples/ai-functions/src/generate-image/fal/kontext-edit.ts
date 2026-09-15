import { fal } from '@ai-sdk/fal';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { images } = await generateImage({
    model: fal.image('fal-ai/flux-pro/kontext/max'),
    prompt: {
      text: 'Put a donut next to the flour.',
      images: [
        'https://v3.fal.media/files/rabbit/rmgBxhwGYb2d3pl3x9sKf_output.png',
      ],
    },
  });
  await presentImages(images);
});
