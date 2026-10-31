import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { images } = await generateImage({
    model: 'bfl/flux-2-pro',
    prompt: {
      text: 'A baby elephant with a shirt that has the logo from input image 1',
      images: ['https://avatars.githubusercontent.com/in/1765080'],
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
