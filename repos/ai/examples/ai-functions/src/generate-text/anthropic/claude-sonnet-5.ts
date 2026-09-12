import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-5'),
    prompt:
      'How many "r"s are in the word "strawberry", and what is the square root of 144? Then, how much is the product of both of the resulting values? Think hard about it. Only respond with the resulting final number, nothing more.',
    maxRetries: 0,
    // Claude Sonnet 5 uses adaptive thinking.
    reasoning: 'medium',
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  print('Content:', result.content);
  print('Reasoning:', result.finalStep.reasoningText);
  print('Usage:', result.usage);
  print('Finish reason:', result.finishReason);
  print('Raw finish reason:', result.rawFinishReason);

  return result;
});
