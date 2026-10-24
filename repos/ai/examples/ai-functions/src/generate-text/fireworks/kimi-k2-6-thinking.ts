import {
  fireworks,
  type FireworksLanguageModelOptions,
} from '@ai-sdk/fireworks';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: fireworks('accounts/fireworks/models/kimi-k2p6'),
    providerOptions: {
      fireworks: {
        thinking: { type: 'enabled', budgetTokens: 4096 },
      } satisfies FireworksLanguageModelOptions,
    },
    prompt: 'How many "r"s are in the word "strawberry"?',
  });

  console.log('\nREASONING:\n');
  console.log(result.reasoningText);

  console.log('\nTEXT:\n');
  console.log(result.text);

  console.log();
  console.log('Usage:', result.usage);
});
