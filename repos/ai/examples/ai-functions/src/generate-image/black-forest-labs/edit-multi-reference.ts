import {
  blackForestLabs,
  type BlackForestLabsImageModelOptions,
} from '@ai-sdk/black-forest-labs';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const prompt =
    'Combine the style of image 1 with the subject of image 2 in a creative composition';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: blackForestLabs.image('flux-kontext-pro'),
    prompt: {
      text: prompt,
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/1200px-Cat_November_2010-1a.jpg',
      ],
    },
    providerOptions: {
      blackForestLabs: {
        outputFormat: 'png',
      } satisfies BlackForestLabsImageModelOptions,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
