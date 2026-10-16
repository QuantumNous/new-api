import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const step1 = await generateText({
    model: google('gemini-3-pro-image-preview'),
    prompt:
      'Create an image of Los Angeles where all car infrastructure has been replaced with bike infrastructure, trains, pedestrian zones, and parks. The image should be photorealistic and vibrant.',
  });

  await presentImages(step1.files);

  const step2 = await generateText({
    model: google('gemini-3-pro-image-preview'),
    messages: [
      ...step1.responseMessages,
      {
        role: 'user',
        content:
          'Now create a variation of the image, but in the style of a watercolor painting.',
      },
    ],
  });

  await presentImages(step2.files);
});
