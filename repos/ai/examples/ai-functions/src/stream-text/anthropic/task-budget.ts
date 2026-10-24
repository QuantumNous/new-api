import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-opus-4-7'),
    prompt: 'Research the pros and cons of Rust vs Go for building CLI tools.',
    maxRetries: 0,
    providerOptions: {
      anthropic: {
        taskBudget: {
          type: 'tokens',
          total: 400000,
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Usage:', await result.usage);
});
