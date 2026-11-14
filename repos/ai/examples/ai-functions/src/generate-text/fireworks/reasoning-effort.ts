import { fireworks } from '@ai-sdk/fireworks';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: fireworks('accounts/fireworks/models/gpt-oss-120b'),
    reasoning: 'medium',
    prompt: 'How many "r"s are in the word "strawberry"?',
  });

  console.log('Reasoning:');
  console.log(result.reasoningText);
  console.log();

  console.log('Text:');
  console.log(result.text);
  console.log();

  console.log('Token usage:', result.usage);
});
