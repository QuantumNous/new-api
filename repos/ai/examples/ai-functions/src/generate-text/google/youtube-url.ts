import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-flash'),
    maxOutputTokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Summarize this video and its main points.' },
          {
            type: 'file',
            data: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            mediaType: 'video/mp4',
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
