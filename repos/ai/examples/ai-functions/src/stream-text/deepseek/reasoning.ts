import { deepSeek } from '@ai-sdk/deepseek';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: deepSeek('deepseek-reasoner'),
    reasoning: 'medium',
    prompt: 'How many "r"s are in the word "strawberry"?',
  });

  let enteredReasoning = false;
  let enteredText = false;
  for await (const part of result.stream) {
    if (part.type === 'reasoning-delta') {
      if (!enteredReasoning) {
        enteredReasoning = true;
        console.log('\nREASONING:\n');
      }
      process.stdout.write(part.text);
    } else if (part.type === 'text-delta') {
      if (!enteredText) {
        enteredText = true;
        console.log('\nTEXT:\n');
      }
      process.stdout.write(part.text);
    }
  }
});
