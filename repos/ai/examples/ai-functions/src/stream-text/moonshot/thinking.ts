import {
  moonshotai,
  type MoonshotAILanguageModelOptions,
} from '@ai-sdk/moonshotai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: moonshotai('kimi-k2-thinking'),
    prompt:
      'Solve this problem step by step: If a train travels 120 miles in 2 hours, how far will it travel in 5 hours at the same speed?',
    providerOptions: {
      moonshotai: {
        thinking: {
          type: 'enabled',
          budgetTokens: 2048,
        },
        reasoningHistory: 'interleaved',
      } satisfies MoonshotAILanguageModelOptions,
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
