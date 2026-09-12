import { generateImage } from 'ai';
import { myImageModels } from './setup-registry';
import { presentImages } from '../lib/present-image';
import { run } from '../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: myImageModels.imageModel('flux'),
    prompt: 'The Loch Ness Monster getting a manicure',
  });

  await presentImages([image]);
});
