import { alibaba, type AlibabaLanguageModelChatOptions } from '@ai-sdk/alibaba';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: alibaba('qwen3-max'),
    prompt: 'Describe the movie Interstellar in detail.',
    providerOptions: {
      alibaba: {
        enableThinking: true,
        thinkingBudget: 50,
      } satisfies AlibabaLanguageModelChatOptions,
    },
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'reasoning-start':
        console.log('--- Reasoning Process ---');
        break;

      case 'reasoning-delta':
        process.stdout.write(part.text);
        break;

      case 'reasoning-end':
        console.log('\n--- End Reasoning ---\n');
        break;

      case 'text-delta':
        process.stdout.write(part.text);
        break;
    }
  }

  const usage = await result.usage;
  console.log('\n\nUsage:', usage);
  console.log(
    'Was budget respected?',
    (usage.outputTokenDetails.reasoningTokens ?? 0) <= 50,
  );
  console.log('Finish reason:', await result.finishReason);
});
