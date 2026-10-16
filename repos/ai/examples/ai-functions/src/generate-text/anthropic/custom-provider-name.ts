import {
  createAnthropic,
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

run(async () => {
  const customProvider = createAnthropic({
    name: 'my-custom-anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Case 1: Using canonical 'anthropic' key in providerOptions
  const result1 = await generateText({
    model: customProvider('claude-sonnet-4-20250514'),
    prompt: 'Say "hello" in one word.',
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 5000 },
      } satisfies AnthropicLanguageModelOptions,
    },
  });
  print('Result 1 - Content:', result1.text);
  print('Result 1 - providerMetadata:', result1.finalStep.providerMetadata);
  // Should only have 'anthropic' key

  // Case 2: Using custom provider key in providerOptions
  const result2 = await generateText({
    model: customProvider('claude-sonnet-4-20250514'),
    prompt: 'Say "world" in one word.',
    providerOptions: {
      'my-custom-anthropic': {
        thinking: { type: 'enabled', budgetTokens: 5000 },
      },
    },
  });
  print('Result 2 - Content:', result2.text);
  print('Result 2 - providerMetadata:', result2.finalStep.providerMetadata);
  // Should have both 'anthropic' and 'my-custom-anthropic' keys

  // Case 3: No providerOptions
  const result3 = await generateText({
    model: customProvider('claude-sonnet-4-20250514'),
    prompt: 'Say "test" in one word.',
  });
  print('Result 3 - Content:', result3.text);
  print('Result 3 - providerMetadata:', result3.finalStep.providerMetadata);
  // Should only have 'anthropic' key

  const result4 = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'Say "BANANA" in one word.',
  });
  print('Result 4 - Content:', result4.text);
  print('Result 4 - providerMetadata:', result4.finalStep.providerMetadata);
  // Should only have 'anthropic' key

  const result5 = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'Say "TEST 5" in one word.',
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 5000 },
      } satisfies AnthropicLanguageModelOptions,
    },
  });
  print('Result 5 - Content:', result5.text);
  print('Result 5 - providerMetadata:', result5.finalStep.providerMetadata);
  // Should only have 'anthropic' key

  const result6 = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    prompt: 'Say "TEST 6" in one word.',
    providerOptions: {
      'my-custom-anthropic': {
        thinking: { type: 'enabled', budgetTokens: 5000 },
      },
    },
  });
  print('Result 6 - Content:', result6.text);
  print('Result 6 - providerMetadata:', result6.finalStep.providerMetadata);
  // Should only have 'anthropic' key (custom key ignored for default provider)
});
