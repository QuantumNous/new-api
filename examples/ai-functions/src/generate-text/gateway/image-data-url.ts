import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  // Read the image file and create a proper data URL
  const imageData = fs.readFileSync('./data/comic-cat.png');
  const base64Data = imageData.toString('base64');
  const dataUrl = `data:image/png;base64,${base64Data}`;

  const result = await generateText({
    model: 'xai/grok-3',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image',
            data: dataUrl,
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
