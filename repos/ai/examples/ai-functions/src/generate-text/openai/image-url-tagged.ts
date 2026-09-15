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
            mediaType: 'image/png',
            data: {
              type: 'url',
              url: new URL(
                'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/comic-cat.png?raw=true',
              ),
            },
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
