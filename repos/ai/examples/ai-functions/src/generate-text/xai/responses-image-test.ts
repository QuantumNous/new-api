import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import 'dotenv/config';

async function main() {
  console.log('Testing xai.responses() with image...');

  const result = await generateText({
    model: xai.responses('grok-4-1-fast-non-reasoning'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What do you see in this image?' },
          {
            type: 'file',
            mediaType: 'image',
            data: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg',
          },
        ],
      },
    ],
  });

  console.log('Response:', result.text);
}

main().catch(console.error);
