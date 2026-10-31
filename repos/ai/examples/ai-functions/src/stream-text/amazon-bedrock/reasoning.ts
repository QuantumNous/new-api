import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { isStepCount, streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: amazonBedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    prompt: 'How many "r"s are in the word "strawberry"?',
    temperature: 0.5, // should get ignored (warning)
    onError: error => {
      console.error(error);
    },
    reasoning: 'low',
    maxRetries: 0,
    stopWhen: isStepCount(5),
  });

  for await (const part of result.stream) {
    if (part.type === 'reasoning-delta') {
      process.stdout.write('\x1b[34m' + part.text + '\x1b[0m');
    } else if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }

  console.log();
  console.log('Warnings:', await result.warnings);
});
