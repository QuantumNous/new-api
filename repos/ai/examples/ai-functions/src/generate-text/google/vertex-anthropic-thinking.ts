import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: vertexAnthropic('claude-sonnet-4-5@20250929'),
    prompt: 'How many "r"s are in the word "strawberry"?',
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 10000 },
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

  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Warnings:', result.warnings);
});
