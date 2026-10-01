import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import 'dotenv/config';

async function main() {
  console.log(
    'Testing xai.responses() with image in multiturn conversation...\n',
  );

  const imageUrl =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg';

  console.log('Turn 1: Describe the image');
  const result1 = await generateText({
    model: xai.responses('grok-4-1-fast-non-reasoning'),
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
  console.log('Response:', result1.text);
  console.log();

  console.log('Turn 2: Follow-up question about the image');
  const result2 = await generateText({
    model: xai.responses('grok-4-1-fast-non-reasoning'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image briefly.' },
          { type: 'file', mediaType: 'image', data: imageUrl },
        ],
      },
      {
        role: 'assistant',
        content: result1.text,
      },
      {
        role: 'user',
        content: 'What color are the eyes?',
      },
    ],
  });
  console.log('Response:', result2.text);
}

main().catch(console.error);
