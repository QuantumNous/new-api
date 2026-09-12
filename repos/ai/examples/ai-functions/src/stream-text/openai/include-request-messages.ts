import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-5-nano'),
    prompt: 'Invent a new holiday and describe its traditions.',
    include: {
      requestMessages: true,
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  print('Request metadata:', await result.request);
});
