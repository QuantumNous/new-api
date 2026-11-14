import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5.1'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  printFullStream({ result });

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
