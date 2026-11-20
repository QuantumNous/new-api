import { huggingFace } from '@ai-sdk/huggingface';
import {
  extractReasoningMiddleware,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: wrapLanguageModel({
      model: huggingFace('deepseek-ai/DeepSeek-R1'),
      middleware: [extractReasoningMiddleware({ tagName: 'think' })],
    }),
    prompt: 'How many "r"s are in the word "strawberry"?',
  });

  console.log('Response:');
  console.log(result.text);
  console.log();
  console.log('Reasoning:');
  console.log(result.reasoning);
  console.log();
  console.log('Token usage:', result.usage);
});
