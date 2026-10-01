import { createGoogleVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const vertexAnthropic = createGoogleVertexAnthropic({
  location: 'eu',
});

run(async () => {
  const result = await generateText({
    model: vertexAnthropic('claude-opus-4-7'),
    prompt: 'Say hello in one sentence.',
    maxRetries: 0,
  });

  console.log(result.text);
});
