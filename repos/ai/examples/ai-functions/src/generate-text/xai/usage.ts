import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai('grok-3-mini'),
    prompt: 'Say a single word.',
  });

  console.log('text:', result.text);
  console.log();
  console.log('raw usage:', JSON.stringify(result.response.body, null, 2));
  console.log();
  console.log('sdk usage:', JSON.stringify(result.usage, null, 2));
});
