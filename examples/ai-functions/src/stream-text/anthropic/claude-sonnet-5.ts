import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-sonnet-5'),
    prompt:
      'How many "r"s are in the word "strawberry", and what is the square root of 144? Then, how much is the product of both of the resulting values? Think hard about it. Only respond with the resulting final number, nothing more.',
    maxRetries: 0,
    // Claude Sonnet 5 uses adaptive thinking. `display: 'summarized'` is
    // required to receive reasoning output in the stream.
    reasoning: 'medium',
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  for await (const part of result.stream) {
    if (part.type === 'reasoning-delta') {
      process.stdout.write('\x1b[34m' + part.text + '\x1b[0m');
    } else if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }

  console.log();
  console.log('Usage:', await result.usage);
});
