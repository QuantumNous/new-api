import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { generateText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-3-pro-image-preview'),
    prompt: 'Generate a high-quality landscape photo of mountains at sunset',
    providerOptions: {
      google: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '4K',
        },
      } satisfies GoogleLanguageModelOptions,
    },
  });

  console.log('Text:', result.text);
  console.log('Image size requested: 4K');
  console.log('Aspect ratio: 16:9');

  for (const file of result.files) {
    if (file.mediaType.startsWith('image/')) {
      await presentImages([file]);
    }
  }
});
