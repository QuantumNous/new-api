import { cohere } from '@ai-sdk/cohere';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: cohere('command-a-reasoning-08-2025'),
    reasoning: 'medium',
    prompt:
      "Alice has 3 brothers and she also has 2 sisters. How many sisters does Alice's brother have?",
  });

  console.log('Reasoning:');
  console.log(result.reasoningText);
  console.log();

  console.log('Text:');
  console.log(result.text);
  console.log();

  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
