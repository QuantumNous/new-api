import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: xai.responses('grok-3-mini-latest'),
    reasoning: 'medium',
    prompt: 'How many "r"s are in the word "strawberry"?',
  });

  let inReasoning = false;
  let inText = false;

  for await (const part of result.stream) {
    if (part.type === 'reasoning-delta') {
      if (!inReasoning) {
        console.log('Reasoning:');
        inReasoning = true;
      }
      process.stdout.write(part.text);
    }
    if (part.type === 'text-delta') {
      if (!inText) {
        if (inReasoning) console.log('\n');
        console.log('Response:');
        inText = true;
      }
      process.stdout.write(part.text);
    }
  }

  console.log('\n');
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
