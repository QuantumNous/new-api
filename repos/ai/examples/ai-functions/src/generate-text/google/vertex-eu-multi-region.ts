import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const vertex = createGoogleVertex({
  location: 'us',
});

run(async () => {
  const result = await generateText({
    model: vertex('gemini-3.5-flash'),
    prompt: 'Say hello in one word.',
    maxRetries: 0,
  });

  console.log(result.text);
});
