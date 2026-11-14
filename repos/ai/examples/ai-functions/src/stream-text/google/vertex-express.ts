import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const vertex = createGoogleVertex({
    apiKey: process.env.GOOGLE_VERTEX_API_KEY,
  });

  const result = streamText({
    model: vertex('gemini-2.0-flash'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
