import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-flash-image'),
    prompt: 'Generate an image of a comic cat',
  });

  console.log(result.text);

  for (const file of result.files) {
    if (file.mediaType.startsWith('image/')) {
      await presentImages([file]);
    }
  }
});
