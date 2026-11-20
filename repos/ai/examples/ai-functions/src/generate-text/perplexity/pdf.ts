import { perplexity } from '@ai-sdk/perplexity';
import { generateText } from 'ai';
import fs from 'fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: perplexity('sonar-pro'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What is this document about? Provide a brief summary.',
          },
          {
            type: 'file',
            data: fs.readFileSync('./data/ai.pdf'),
            mediaType: 'application/pdf',
            filename: 'ai.pdf',
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
