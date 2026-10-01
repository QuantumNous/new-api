import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, isStepCount } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: amazonBedrock('us.anthropic.claude-opus-4-6-v1'),
    prompt: 'How many "r"s are in the word "strawberry"?',
    reasoning: 'xhigh',
    maxRetries: 0,
    stopWhen: isStepCount(5),
  });

  console.log('Reasoning:');
  console.log(result.reasoning);
  console.log();

  console.log('Text:');
  console.log(result.text);
  console.log();

  console.log('Warnings:', result.warnings);
});
