import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google.interactions('gemini-2.5-flash'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Summarize this PDF in 3 short bullet points.',
          },
          {
            type: 'file',
            mediaType: 'application/pdf',
            data: fs.readFileSync('./data/ai.pdf'),
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
  console.log(
    'Interaction id:',
    (await result.finalStep).providerMetadata?.google?.interactionId,
  );
});
