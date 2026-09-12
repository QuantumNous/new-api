import { replicate } from '@ai-sdk/replicate';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: replicate.image(
      'bytedance/sdxl-lightning-4step:5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637',
    ),
    prompt: 'The Loch Ness Monster getting a manicure',
  });

  await presentImages([image]);
});
