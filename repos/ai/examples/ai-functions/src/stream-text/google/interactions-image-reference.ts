import { google } from '@ai-sdk/google';
import { streamText, uploadFile } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const { providerReference, mediaType } = await uploadFile({
    api: google.files(),
    data: fs.readFileSync('./data/comic-cat.png'),
    mediaType: 'image/png',
  });

  console.log('Uploaded file reference:', providerReference);

  const result = streamText({
    model: google.interactions('gemini-3.5-flash'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: mediaType ?? 'image/png',
            data: providerReference,
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
