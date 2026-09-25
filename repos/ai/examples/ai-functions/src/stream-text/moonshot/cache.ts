import { moonshotai } from '@ai-sdk/moonshotai';
import { streamText } from 'ai';
import { run } from '../../lib/run';
import fs from 'node:fs';

run(async () => {
  const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');
  const largeContext = errorMessage.repeat(100);

  const result = streamText({
    model: moonshotai('kimi-k2-thinking'),
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

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
