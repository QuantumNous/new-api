import { vercel } from '@ai-sdk/vercel';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: vercel('v0-1.5-md'),
    prompt: 'Implement Fibonacci in Lua.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
