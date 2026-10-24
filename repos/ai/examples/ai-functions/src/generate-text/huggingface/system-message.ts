import { huggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: huggingFace('meta-llama/Llama-3.1-8B-Instruct'),
    instructions:
      'You are a helpful assistant that always responds in a pirate accent.',
    prompt: 'Tell me about the weather today.',
  });

  console.log(result.text);
  console.log();
  console.log('Usage:', result.usage);
});
