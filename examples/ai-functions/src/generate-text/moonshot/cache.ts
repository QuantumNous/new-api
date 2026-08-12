import { moonshotai } from '@ai-sdk/moonshotai';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import fs from 'node:fs';

run(async () => {
  const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');
  const largeContext = errorMessage.repeat(100);

  const result = await generateText({
    model: moonshotai('kimi-k2.5'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: largeContext,
          },
          {
            type: 'text',
            text: 'Review this code: const x = 1;',
          },
        ],
      },
    ],
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
