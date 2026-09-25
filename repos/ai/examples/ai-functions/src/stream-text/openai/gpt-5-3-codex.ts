import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

run(async () => {
  const result = streamText({
    model: openai('gpt-5.3-codex'),
    prompt: 'Write a JavaScript function that returns the sum of two numbers.',
    maxRetries: 0,
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  process.stdout.write('\n');
  print('Usage:', await result.usage);
  print('Finish reason:', await result.finishReason);
});
