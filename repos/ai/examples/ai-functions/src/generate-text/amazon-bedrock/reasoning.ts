import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, isStepCount } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: amazonBedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    prompt: 'How many "r"s are in the word "strawberry"?',
    temperature: 0.5, // should get ignored (warning)
    reasoning: 'medium',
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
