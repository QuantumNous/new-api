import { mistral } from '@ai-sdk/mistral';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: mistral('magistral-small-2507'),
    messages: [
      {
        role: 'user',
        content: 'Previous context: I solved 3+5=8',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'User mentioned they solved 3+5=8, which is correct.',
          },
          { type: 'text', text: 'Yes, 3 + 5 equals 8.' },
        ],
      },
      {
        role: 'user',
        content: 'How many Rs are in "strawberry"?',
      },
    ],
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'reasoning-start': {
        console.log('\n--- Reasoning ---');
        break;
      }
      case 'reasoning-delta': {
        process.stdout.write(part.text);
        break;
      }
      case 'reasoning-end': {
        console.log('\n--- End Reasoning ---\n');
        break;
      }
      case 'text-delta': {
        process.stdout.write(part.text);
        break;
      }
      case 'finish': {
        console.log('\n\nFinish reason:', part.finishReason);
        console.log('Token usage:', part.totalUsage);
        break;
      }
    }
  }
});
