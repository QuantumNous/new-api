import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5-nano'),
    prompt: 'Invent a new holiday and describe its traditions.',
    include: {
      requestMessages: true,
    },
  });

  console.log(result.text);
  print('Request metadata:', result.request);
});
