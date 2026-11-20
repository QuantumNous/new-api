import { huggingFace } from '@ai-sdk/huggingface';
import { extractReasoningMiddleware, streamText, wrapLanguageModel } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: wrapLanguageModel({
      model: huggingFace('deepseek-ai/DeepSeek-R1'),
      middleware: [extractReasoningMiddleware({ tagName: 'think' })],
    }),
    prompt: 'How many "r"s are in the word "strawberry"?',
  });

  let enteredReasoning = false;
  let enteredText = false;

  for await (const delta of result.stream) {
    switch (delta.type) {
      case 'reasoning-delta':
        if (!enteredReasoning) {
          enteredReasoning = true;
          console.log('REASONING:');
        }
        process.stdout.write(delta.text);
        break;
      case 'text-delta':
        if (!enteredText) {
          enteredText = true;
          console.log('\n\nTEXT:');
        }
        process.stdout.write(delta.text);
        break;
    }
  }

  console.log();
  console.log();
  console.log('Final reasoning:');
  console.log(await result.reasoning);
  console.log();
  console.log('Token usage:', await result.usage);
});
