import { huggingFace } from '@ai-sdk/huggingface';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: huggingFace('Qwen/Qwen2.5-VL-32B-Instruct'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this image and describe what you see in detail.',
          },
          {
            type: 'file',
            mediaType: 'image',
            data: 'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/comic-cat.png?raw=true',
          },
        ],
      },
    ],
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
});
