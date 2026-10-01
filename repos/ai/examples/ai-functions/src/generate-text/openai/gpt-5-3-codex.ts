import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5.3-codex'),
    prompt: 'Write a JavaScript function that returns the sum of two numbers.',
    maxRetries: 0,
  });

  print('Text:', result.text);
  print('Usage:', result.usage);
  print('Finish reason:', result.finishReason);
  print('Raw finish reason:', result.rawFinishReason);
});
