import { run } from '../../lib/run';
import { vertexMaas } from '@ai-sdk/google-vertex/maas';
import { streamText } from 'ai';

run(async () => {
  const result = streamText({
    model: vertexMaas('deepseek-ai/deepseek-v3.2-maas'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
