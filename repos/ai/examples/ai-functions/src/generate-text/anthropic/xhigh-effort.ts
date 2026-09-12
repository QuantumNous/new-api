import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-opus-4-8'),
    prompt:
      'Solve this step by step: if f(x) = x^3 - 6x^2 + 11x - 6, find all roots and prove they are correct.',
    reasoning: 'xhigh',
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  print('Reasoning:', result.reasoningText);
  print('Content:', result.text);
  print('Usage:', result.usage);
});
