import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-4o'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image',
            data: 'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/comic-cat.png?raw=true',

            // OpenAI specific option - image detail:
            providerOptions: {
              openai: { imageDetail: 'low' },
            },
          },
        ],
      },
    ],
  });

  console.log(result.text);
  console.log();
  console.log('REQUEST');
  console.log(JSON.stringify(result.request!.body, null, 2));
});
