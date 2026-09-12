import { openai } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const prompt = 'A blue cream Persian cat in Kyoto in the style of ukiyo-e';
  const result = await generateImage({
    model: openai.image('gpt-image-1.5'),
    prompt,
    n: 3,
  });

  await presentImages(result.images);

  console.log(
    'Provider metadata:',
    JSON.stringify(result.providerMetadata, null, 2),
  );
});
