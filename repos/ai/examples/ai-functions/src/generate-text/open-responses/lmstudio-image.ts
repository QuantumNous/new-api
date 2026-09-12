import { createOpenResponses } from '@ai-sdk/open-responses';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

const lmstudio = createOpenResponses({
  name: 'lmstudio',
  url: 'http://localhost:1234/v1/responses',
});

run(async () => {
  const result = await generateText({
    model: lmstudio('mistralai/ministral-3-14b-reasoning'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image',
            data: fs.readFileSync('./data/comic-cat.png'),
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
