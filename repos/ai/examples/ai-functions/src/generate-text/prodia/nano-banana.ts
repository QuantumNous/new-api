import { prodia, type ProdiaLanguageModelOptions } from '@ai-sdk/prodia';
import { generateText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: prodia.languageModel('inference.nano-banana.img2img.v2'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image',
            data: 'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
          },
          {
            type: 'text',
            text: 'Make this image look like a watercolor painting',
          },
        ],
      },
    ],
    providerOptions: {
      prodia: {
        aspectRatio: '1:1',
      } satisfies ProdiaLanguageModelOptions,
    },
  });

  console.log('Text response:', result.text);

  for (const file of result.files) {
    if (file.mediaType.startsWith('image/')) {
      await presentImages([file]);
    }
  }
});
