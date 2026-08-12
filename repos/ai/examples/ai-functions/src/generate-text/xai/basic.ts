import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai('grok-3-beta'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
