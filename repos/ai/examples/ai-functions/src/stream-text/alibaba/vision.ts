import { alibaba } from '@ai-sdk/alibaba';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: alibaba('qwen-vl-max'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What color is this image? Answer in one word.',
          },
          {
            type: 'file',
            mediaType: 'image',
            data: 'https://placehold.co/10x10/red/red.png',
          },
        ],
      },
    ],
  });

  console.log('Streaming vision model response:\n');

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log('\n\n--- Final State ---');
  console.log('Usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
