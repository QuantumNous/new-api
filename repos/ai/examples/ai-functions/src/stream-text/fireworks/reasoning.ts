import { fireworks } from '@ai-sdk/fireworks';
import { extractReasoningMiddleware, streamText, wrapLanguageModel } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: wrapLanguageModel({
      model: fireworks('accounts/fireworks/models/qwq-32b'),
      middleware: extractReasoningMiddleware({
        tagName: 'think',
        startWithReasoning: true,
      }),
    }),
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
