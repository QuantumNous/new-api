import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google('gemini-2.5-pro'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Watch this video and provide a detailed analysis of its content, themes, and any notable elements.',
          },
          {
            type: 'file',
            data: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            mediaType: 'video/mp4',
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
  console.log('Finish reason:', await result.finishReason);
});
