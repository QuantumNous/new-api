import { googleVertexXai } from '@ai-sdk/google-vertex/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: googleVertexXai('xai/grok-4.1-fast-reasoning'),
    prompt: 'What is the meaning of life?',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
