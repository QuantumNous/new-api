import { huggingFace } from '@ai-sdk/huggingface';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: huggingFace('meta-llama/Llama-3.1-8B-Instruct'),
    instructions:
      'You are a knowledgeable chef who loves to share cooking tips and recipes.',
    prompt: 'How do I make the perfect scrambled eggs?',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
});
