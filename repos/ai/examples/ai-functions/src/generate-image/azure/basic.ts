import { azure } from '@ai-sdk/azure';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: azure.imageModel('gpt-image-2'), // Use your own deployment
    prompt: 'Santa Claus driving a Cadillac',
  });

  await presentImages([image]);
});
