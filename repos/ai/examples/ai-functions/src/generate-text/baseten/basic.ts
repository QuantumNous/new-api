import { baseten } from '@ai-sdk/baseten';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  // Using default Model APIs - works with hosted models on Baseten
  const { text, usage } = await generateText({
    model: baseten('deepseek-ai/DeepSeek-V3-0324'),
    prompt: 'What is the meaning of life? Answer in one sentence.',
  });

  console.log(text);
  console.log();
  console.log('Usage:', usage);
});
