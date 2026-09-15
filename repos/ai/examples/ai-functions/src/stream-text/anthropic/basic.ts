import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { print } from '../../lib/print';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    prompt: 'Invent a new holiday and describe its traditions.',
    maxRetries: 0,
    include: {
      rawChunks: true,
    },
  });

  printFullStream({ result });

  print('Usage:', await result.usage);
  print('Finish reason:', await result.finishReason);
  print('Raw finish reason:', await result.rawFinishReason);

  return result;
});
