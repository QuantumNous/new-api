import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: xai.responses('grok-4-1-fast-reasoning'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
