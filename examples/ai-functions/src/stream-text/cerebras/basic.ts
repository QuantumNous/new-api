import { cerebras } from '@ai-sdk/cerebras';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: cerebras('llama3.1-8b'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result);
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
