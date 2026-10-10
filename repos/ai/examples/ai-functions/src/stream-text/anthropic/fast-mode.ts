import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { print } from '../../lib/print';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-opus-4-6'),
    prompt: 'Invent a new holiday and describe its traditions.',
    providerOptions: {
      anthropic: {
        speed: 'fast',
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  printFullStream({ result });

  print('Usage:', await result.usage);
  print('Finish reason:', await result.finishReason);
});
