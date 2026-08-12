import { mistral } from '@ai-sdk/mistral';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: mistral('ministral-8b-latest'),
    maxOutputTokens: 512,
    temperature: 0.3,
    maxRetries: 5,
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
