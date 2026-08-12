import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5-nano'),
    prompt: 'Invent a new holiday and describe its traditions.',
    maxRetries: 0,
  });

  print('Content:', result.content);
  print('Usage:', result.usage);
  print('Finish reason:', result.finishReason);
  print('Raw finish reason:', result.rawFinishReason);
});
