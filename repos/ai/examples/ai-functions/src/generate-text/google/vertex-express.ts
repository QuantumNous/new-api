import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const vertex = createGoogleVertex({
    apiKey: process.env.GOOGLE_VERTEX_API_KEY,
  });

  const result = await generateText({
    model: vertex('gemini-2.0-flash'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
