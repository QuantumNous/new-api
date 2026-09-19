import {
  fireworks,
  type FireworksLanguageModelOptions,
} from '@ai-sdk/fireworks';
import { streamText } from 'ai';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: fireworks('accounts/fireworks/models/kimi-k2p6'),
    providerOptions: {
      fireworks: {
        thinking: { type: 'enabled', budgetTokens: 4096 },
      } satisfies FireworksLanguageModelOptions,
    },
    prompt: 'How many "r"s are in the word "strawberry"?',
  });

  printFullStream({ result });
});
