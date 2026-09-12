import { huggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: huggingFace.responses('moonshotai/Kimi-K2-Instruct'),
    prompt: 'Tell me a three sentence bedtime story about a unicorn.',
  });

  console.log(result.text);
  console.log(result.usage);
});
