import { alibaba, type AlibabaLanguageModelChatOptions } from '@ai-sdk/alibaba';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: alibaba('qwen3-max'),
    prompt: 'What is the sum of the first 3 prime numbers?',
    providerOptions: {
      alibaba: {
        enableThinking: true,
      } satisfies AlibabaLanguageModelChatOptions,
    },
  });

  let inReasoning = false;

  for await (const part of result.stream) {
    switch (part.type) {
      case 'reasoning-start': {
        console.log('\n--- Reasoning Process ---');
        inReasoning = true;
        break;
      }
      case 'reasoning-delta': {
        process.stdout.write(part.text);
        break;
      }
      case 'reasoning-end': {
        console.log('\n--- End Reasoning ---\n');
        inReasoning = false;
        break;
      }
      case 'text-delta': {
        if (!inReasoning) {
          process.stdout.write(part.text);
        }
        break;
      }
    }
  }

  console.log('\n\nFinish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
});
