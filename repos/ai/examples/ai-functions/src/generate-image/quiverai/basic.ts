import { quiverai } from '@ai-sdk/quiverai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { images } = await generateImage({
    model: quiverai.image('arrow-1.1'),
    prompt: 'A geometric logo for an AI design startup',
  });

  await presentImages(images);
});
