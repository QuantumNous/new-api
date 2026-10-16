import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-flash'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is the audio saying?' },
          {
            type: 'file',
            mediaType: 'audio/mpeg',
            data: fs.readFileSync('./data/galileo.mp3'),
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
