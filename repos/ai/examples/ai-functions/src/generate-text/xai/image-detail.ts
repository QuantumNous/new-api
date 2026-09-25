import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai('grok-4.5'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image/png',
            data: fs.readFileSync('./data/comic-cat.png'),
            // process the image at reduced resolution (fewer input tokens)
            providerOptions: { xai: { imageDetail: 'low' } },
          },
        ],
      },
    ],
  });

  console.log(result.text);
  console.log();
  console.log('Usage:', result.usage);
});
