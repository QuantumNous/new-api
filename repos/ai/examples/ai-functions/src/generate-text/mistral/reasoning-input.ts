import { mistral } from '@ai-sdk/mistral';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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

  console.log('Reasoning content:');
  if (result.reasoningText) {
    console.log(result.reasoningText);
    console.log();
  }

  console.log('Final answer:');
  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
});
