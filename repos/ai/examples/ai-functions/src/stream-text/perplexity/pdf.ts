import { perplexity } from '@ai-sdk/perplexity';
import { streamText } from 'ai';
import fs from 'fs';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
});
