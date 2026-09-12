import { googleVertexXai } from '@ai-sdk/google-vertex/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const imageUrl =
    'https://images.pexels.com/photos/36501108/pexels-photo-36501108.jpeg';
  const result = await generateText({
    model: googleVertexXai('xai/grok-4.20-reasoning'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image briefly.' },
          { type: 'file', mediaType: 'image', data: imageUrl },
        ],
      },
    ],
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
