import { run } from '../../lib/run';
import { vertexMaas } from '@ai-sdk/google-vertex/maas';
import { generateText } from 'ai';

run(async () => {
  const result = await generateText({
    model: vertexMaas('moonshotai/kimi-k2-thinking-maas'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
