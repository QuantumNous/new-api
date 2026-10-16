import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: 'How many "r"s are in the word "strawberry"?',
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled' },
      } satisfies AnthropicLanguageModelOptions,
    },
    maxRetries: 0,
  });

  console.log('Reasoning:');
  console.log(result.reasoning);
  console.log();

  console.log('Text:');
  console.log(result.text);
  console.log();

  console.log('Warnings:', result.warnings);
});
