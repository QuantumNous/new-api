import { deepSeek } from '@ai-sdk/deepseek';
import { streamText } from 'ai';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: deepSeek('deepseek-chat'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  printFullStream({ result });
});
