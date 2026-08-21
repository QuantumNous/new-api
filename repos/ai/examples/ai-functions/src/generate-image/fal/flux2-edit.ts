import { fal, type FalImageModelOptions } from '@ai-sdk/fal';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { images } = await generateImage({
    model: fal.image('fal-ai/flux-2/edit'),
    prompt: {
      text: 'Change his clothes to a tuxedo in the first image, and add the flour packet from the second image to the flour bag in the first image',
      images: [
        'https://storage.googleapis.com/falserverless/example_inputs/flux2_dev_edit_input.png',
        'https://v3.fal.media/files/rabbit/rmgBxhwGYb2d3pl3x9sKf_output.png',
      ],
    },
    providerOptions: {
      fal: {
        useMultipleImages: true,
      } satisfies FalImageModelOptions,
    },
  });
  await presentImages(images);
});
